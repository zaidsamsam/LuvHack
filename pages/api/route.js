import { supabase } from "../../lib/supabase";
import axios from "axios";
import rateLimit from "../../lib/rate-limit";

const limiter = rateLimit({
    interval: 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500, // Max 500 users per second
});

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Enforce max 15 requests per minute per IP
        const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'default-ip';
        await limiter.check(res, 15, userIP);
    } catch {
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before searching again.' });
    }

    const { lat, lon, type } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: "lat and lon are required" });
    }

    try {
        const userLat = parseFloat(lat);
        const userLon = parseFloat(lon);

        // Phase 1 Sort: Spatial Radius Constraint (100km)
        // Fetches up to 25 physically closest facilities within 100km using PostGIS ST_DWithin
        let { data: nearby, error } = await supabase.rpc('get_nearest_hospitals', {
            user_lat: userLat,
            user_lng: userLon,
            radius_meters: 100000 // 100 km
        });

        if (error) {
            console.error("Supabase RPC Error:", error);
            return res.status(500).json({ error: 'Failed to fetch from Supabase' });
        }

        if (!nearby || nearby.length === 0) {
            return res.status(200).json([]); // Return empty array if 0 facilities found
        }

        if (type) {
            nearby = nearby.filter(h => h.facility_type === type);
        }

        if (nearby.length === 0) {
            return res.status(200).json([]);
        }

        // Phase 2 Sort: Traffic-Aware Re-Ranking via TomTom Synchronous Matrix API
        const tomtomKey = process.env.TOMTOM_KEY || process.env.NEXT_PUBLIC_TOMTOM_KEY;
        if (!tomtomKey) {
            console.error("Missing TOMTOM_KEY environment variable");
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        const routingUrl = `https://api.tomtom.com/routing/matrix/2?key=${tomtomKey}&traffic=true&travelMode=car&departAt=now`;

        const payload = {
            origins: [
                {
                    point: { latitude: userLat, longitude: userLon }
                }
            ],
            destinations: nearby.map(hospital => ({
                point: { latitude: hospital.latitude, longitude: hospital.longitude }
            }))
        };

        let matrixResults = null;
        try {
            const response = await axios.post(routingUrl, payload, {
                headers: { 'Content-Type': 'application/json' }
            });
            matrixResults = response.data.matrix[0]; // Origins length is 1
        } catch (matrixErr) {
            console.warn("TomTom Matrix API failed (likely 403 Forbidden due to API key tier restriction). Falling back to geographic distance approximation.", matrixErr.message);
        }

        let timeCalculations;

        if (matrixResults) {
            timeCalculations = nearby.map((hospital, index) => {
                const resultCell = matrixResults[index];
                
                // Handle Matrix Error seamlessly
                if (resultCell.statusCode !== 200) {
                    console.warn(`TomTom Matrix Error for ${hospital.name} (status ${resultCell.statusCode})`);
                    return {
                        ...hospital,
                        drive_time: Infinity,
                        total_time: Infinity
                    };
                }

                const routeSummary = resultCell.response.routeSummary;
                if (!routeSummary || typeof routeSummary.travelTimeInSeconds === 'undefined') {
                    return {
                        ...hospital,
                        drive_time: Infinity,
                        total_time: Infinity
                    };
                }

                const travelTimeInSeconds = routeSummary.travelTimeInSeconds;
                const driveTimeMinutes = Math.round(travelTimeInSeconds / 60);
                
                // fake wait time uses the 'base_wait_time' from the db
                const totalTime = driveTimeMinutes + hospital.base_wait_time;

                return {
                    ...hospital,
                    drive_time: driveTimeMinutes,
                    total_time: totalTime
                };
            });
        } else {
             // FALLBACK: If Matrix API is restricted (403), approximate drive time from PostGIS ST_Distance
             // Assume average city speed of 40 km/h (11.11 m/s)
             timeCalculations = nearby.map(hospital => {
                 const approxDriveTimeMinutes = Math.round(hospital.distance / 11.11 / 60);
                 const totalTime = approxDriveTimeMinutes + hospital.base_wait_time;

                 return {
                     ...hospital,
                     drive_time: approxDriveTimeMinutes,
                     total_time: totalTime
                 };
             });
        }

        // Drop invalid hospitals (those with Matrix Errors) and then Sort by Total Time
        const validHospitals = timeCalculations.filter(h => h.total_time !== Infinity);
        validHospitals.sort((a, b) => a.total_time - b.total_time);

        res.status(200).json(validHospitals);
    } catch (err) {
        console.error("API Error", err.message);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}
