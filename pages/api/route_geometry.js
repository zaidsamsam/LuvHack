import axios from "axios";
import rateLimit from "../../lib/rate-limit";

const limiter = rateLimit({
    interval: 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500,
});

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Geometry fetches automatically every 2mins. Give a generous 60 limit per minute to avoid accidental blocks.
        const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'default-ip';
        await limiter.check(res, 60, userIP);
    } catch {
        return res.status(429).json({ error: 'Geometry Rate limit exceeded' });
    }

    const { startLat, startLon, endLat, endLon } = req.query;

    if (!startLat || !startLon || !endLat || !endLon) {
        return res.status(400).json({ error: "Start and end coordinates are required" });
    }

    try {
        const tomtomKey = process.env.TOMTOM_KEY || process.env.NEXT_PUBLIC_TOMTOM_KEY;
        if (!tomtomKey) {
            return res.status(500).json({ error: 'Server misconfiguration: TOMTOM_KEY missing' });
        }

        // Fetch detailed route geometry and traffic sections from TomTom
        const routingUrl = `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLon}:${endLat},${endLon}/json?key=${tomtomKey}&routeType=fastest&traffic=true&travelMode=car&sectionType=traffic&report=effectiveSettings`;

        const response = await axios.get(routingUrl);

        if (!response.data || !response.data.routes || response.data.routes.length === 0) {
            return res.status(404).json({ error: 'No route found' });
        }

        const route = response.data.routes[0];
        const points = route.legs[0].points.map(p => [p.latitude, p.longitude]); // Format for Leaflet Polyline: [lat, lon]
        const sections = route.sections || []; 

        res.status(200).json({ points, sections });

    } catch (err) {
        console.error("Traffic Route API Error", err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to fetch detailed route' });
    }
}
