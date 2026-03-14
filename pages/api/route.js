import { supabase } from "../../lib/supabase";
import axios from "axios";

// Helper for rough Haversine distance in miles
function getDistanceInMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { lat, lon, type } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: "lat and lon are required" });
    }

    try {
        // 1. Fetch nearest hospitals from Supabase
        const { data: hospitals, error } = await supabase.from('hospitals').select('*');
        if (error) {
            console.error("Supabase Error:", error);
            return res.status(500).json({ error: 'Failed to fetch from Supabase' });
        }

        // 2. Filter hospitals: Within 20 miles, and by facility_type if requested
        let nearby = hospitals.filter(h => {
            const dist = getDistanceInMiles(lat, lon, h.latitude, h.longitude);
            return dist <= 20;
        });

        if (type) {
            nearby = nearby.filter(h => h.facility_type === type);
        }

        // 3. Query TomTom Routing API for each hospital to get drive time
        const tomtomKey = process.env.TOMTOM_KEY;

        const timeCalculations = await Promise.all(nearby.map(async (hospital) => {
            const routingUrl = `https://api.tomtom.com/routing/1/calculateRoute/${lat},${lon}:${hospital.latitude},${hospital.longitude}/json?key=${tomtomKey}&traffic=true`;

            try {
                const response = await axios.get(routingUrl);
                const travelTimeInSeconds = response.data.routes[0].summary.travelTimeInSeconds;
                const driveTimeMinutes = Math.round(travelTimeInSeconds / 60);
                const totalTime = driveTimeMinutes + hospital.base_wait_time;

                return {
                    ...hospital,
                    drive_time: driveTimeMinutes,
                    total_time: totalTime
                };
            } catch (e) {
                console.error("Failed to route to", hospital.name, e.response?.data || e.message);
                return {
                    ...hospital,
                    drive_time: Infinity,
                    total_time: Infinity
                };
            }
        }));

        // 4. Sort by Total Time
        const validHospitals = timeCalculations.filter(h => h.total_time !== Infinity);
        validHospitals.sort((a, b) => a.total_time - b.total_time);

        res.status(200).json(validHospitals);
    } catch (err) {
        console.error("API Error", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
