import { supabase } from "../../lib/supabase";
import rateLimit from "../../lib/rate-limit";

const limiter = rateLimit({
    interval: 60 * 1000, 
    uniqueTokenPerInterval: 500, 
});

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'default-ip';
        await limiter.check(res, 30, userIP);
    } catch {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const { q } = req.query;

    if (!q) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        // Search the hospitals table generically for any facility matching the term
        const { data: results, error } = await supabase
            .from('hospitals')
            .select('*')
            .ilike('name', `%${q}%`)
            .limit(1);

        if (error) {
            console.error("Supabase Error:", error);
            return res.status(500).json({ error: 'Failed to search database' });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Not Found' });
        }

        res.status(200).json(results[0]);
    } catch (err) {
        console.error("Search API Error", err.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
