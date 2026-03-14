import { supabase } from "../lib/supabase.js";

const seedData = [
    { name: 'Mercy ER Hospital', latitude: 41.88, longitude: -87.63, base_wait_time: 120, facility_type: 'ER', is_trauma_center: true },
    { name: 'Lakeshore Urgent Care', latitude: 41.89, longitude: -87.61, base_wait_time: 45, facility_type: 'UrgentCare', is_trauma_center: false },
    { name: 'River North General', latitude: 41.89, longitude: -87.63, base_wait_time: 90, facility_type: 'ER', is_trauma_center: true },
    { name: 'Westside Medical Center', latitude: 41.87, longitude: -87.65, base_wait_time: 180, facility_type: 'ER', is_trauma_center: false },
    { name: 'South Loop Emergency', latitude: 41.86, longitude: -87.62, base_wait_time: 50, facility_type: 'ER', is_trauma_center: false },
    { name: 'Pilsen Urgent Care', latitude: 41.85, longitude: -87.66, base_wait_time: 15, facility_type: 'UrgentCare', is_trauma_center: false },
    { name: 'Lincoln Park Hospital', latitude: 41.92, longitude: -87.64, base_wait_time: 110, facility_type: 'ER', is_trauma_center: true },
    { name: 'Lakeview Express Clinic', latitude: 41.94, longitude: -87.65, base_wait_time: 20, facility_type: 'UrgentCare', is_trauma_center: false },
    { name: 'Wicker Park Urgent Care', latitude: 41.91, longitude: -87.67, base_wait_time: 30, facility_type: 'UrgentCare', is_trauma_center: false },
    { name: 'Downtown Express Care', latitude: 41.88, longitude: -87.62, base_wait_time: 25, facility_type: 'UrgentCare', is_trauma_center: false }
];

async function seed() {
    console.log("Seeding databases...");
    const { data, error } = await supabase.from('hospitals').insert(seedData);
    if (error) {
        console.error("Error seeding:", error);
    } else {
        console.log("Seeded successfully:", data);
    }
}

seed();
