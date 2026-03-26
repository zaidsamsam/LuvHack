const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function test() {
    const tomtomKey = process.env.TOMTOM_KEY || process.env.NEXT_PUBLIC_TOMTOM_KEY;
    // Querying Los Angeles during what might be traffic to see section data
    try {
        const res = await axios.get(`https://api.tomtom.com/routing/1/calculateRoute/34.0522,-118.2437:34.0195,-118.4912/json?key=${tomtomKey}&routeType=fastest&traffic=true&travelMode=car&sectionType=traffic&departAt=now`);
        
        const sections = res.data.routes[0].sections;
        console.log("Traffic Sections:", JSON.stringify(sections.filter(s => s.sectionType === 'TRAFFIC').slice(0, 3), null, 2));
    } catch(e) {
        console.log("Error:", e.message);
    }
}
test();
