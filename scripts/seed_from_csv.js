const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log("Reading CSV file...");
    const csvPath = path.resolve(__dirname, '../ER_WAZE_csv/ER_WAZE.csv');
    if (!fs.existsSync(csvPath)) {
        console.error("CSV file not found at", csvPath);
        process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim());
    
    const idxName = headers.indexOf('name');
    const idxLat = headers.indexOf('latitude');
    const idxLon = headers.indexOf('longitude');
    const idxAmenity = headers.indexOf('amenity');
    const idxHealthFacilityType = headers.indexOf('health_facility_type');

    if (idxName === -1 || idxLat === -1 || idxLon === -1) {
        console.error("CSV must contain 'name', 'latitude', and 'longitude' columns.");
        process.exit(1);
    }

    console.log(`Found ${lines.length - 1} records in CSV. Starting seeding...`);
    
    // Clear the existing data
    console.log("Emptying existing hospitals table...");
    const { error: deleteError } = await supabase.from('hospitals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteError) {
        console.warn("Could not delete existing hospitals (maybe table is empty):", deleteError.message);
    }

    let insertedCount = 0;
    
    // Process in batches
    const batchSize = 100;
    let batch = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Regex to split by comma inside quotes correctly
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        
        const name = cols[idxName];
        const lat = parseFloat(cols[idxLat]);
        const lon = parseFloat(cols[idxLon]);
        const amenity = cols[idxAmenity];
        const hft = cols[idxHealthFacilityType];

        if (!name || isNaN(lat) || isNaN(lon)) continue;
        
        let facility_type = 'Clinic';
        let is_trauma_center = false;
        
        if (amenity === 'hospital' || hft === 'hospital') {
            facility_type = 'ER';
            is_trauma_center = true;
        } else if (amenity === 'pharmacy') {
            facility_type = 'Pharmacy';
        } else if (amenity === 'dentist') {
            facility_type = 'Dentist';
        } else if (amenity === 'doctors' || amenity === 'clinic') {
            facility_type = 'UrgentCare';
        } else {
            // Default mapping if something weird
            facility_type = 'UrgentCare';
        }

        const base_wait_time = Math.floor(Math.random() * (120 - 15 + 1) + 15);

        batch.push({
            name,
            latitude: lat,
            longitude: lon,
            base_wait_time,
            facility_type,
            is_trauma_center,
            location: `POINT(${lon} ${lat})`
        });

        if (batch.length === batchSize || i === lines.length - 1) {
            const { error } = await supabase.from('hospitals').insert(batch);
            
            if (error) {
                console.error(`Error inserting batch ending at line ${i}:`, error.message);
            } else {
                insertedCount += batch.length;
                console.log(`Successfully inserted ${insertedCount} facilities so far...`);
            }
            batch = [];
        }
    }

    console.log(`Seeding complete. Inserted ${insertedCount} valid facilities into the 'hospitals' table.`);
}

seed().catch(console.error);
