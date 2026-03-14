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

async function processFile(csvPath) {
    if (!fs.existsSync(csvPath)) {
        console.warn("CSV file not found at", csvPath);
        return [];
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
        console.warn(`CSV at ${csvPath} must contain 'name', 'latitude', and 'longitude' columns.`);
        return [];
    }

    let records = [];
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
            facility_type = 'UrgentCare';
        }

        const base_wait_time = Math.floor(Math.random() * (120 - 15 + 1) + 15);

        records.push({
            name,
            latitude: lat,
            longitude: lon,
            base_wait_time,
            facility_type,
            is_trauma_center,
            location: `POINT(${lon} ${lat})`
        });
    }

    console.log(`Parsed ${records.length} valid records from ${csvPath}`);
    return records;
}

async function seed() {
    const filesToMerge = [
        path.resolve(__dirname, '../ER_WAZE_csv/ER_WAZE.csv'),
        path.resolve(__dirname, '../ER_WAZE_riyadh_csv/ER_WAZE_riyadh_csv.csv')
    ];

    let allFacilities = [];

    for (const file of filesToMerge) {
        const fileRecords = await processFile(file);
        allFacilities = allFacilities.concat(fileRecords);
    }
    
    console.log(`Found a total of ${allFacilities.length} aggregated facilities to seed.`);

    // Clear the existing data
    console.log("Emptying existing hospitals table...");
    const { error: deleteError } = await supabase.from('hospitals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteError) {
        console.warn("Could not delete existing hospitals:", deleteError.message);
    }

    let insertedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < allFacilities.length; i += batchSize) {
        const batch = allFacilities.slice(i, i + batchSize);
        const { error } = await supabase.from('hospitals').insert(batch);
        
        if (error) {
            console.error(`Error inserting batch ending at index ${i + batch.length}:`, error.message);
        } else {
            insertedCount += batch.length;
            console.log(`Successfully inserted ${insertedCount} facilities so far...`);
        }
    }

    console.log(`Aggregated seeding complete. Inserted ${insertedCount} valid facilities across both datasets.`);
}

seed().catch(console.error);
