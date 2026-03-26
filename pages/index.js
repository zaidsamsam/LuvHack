import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import axios from "axios";
import Triage from "../components/Triage";
import HospitalList from "../components/HospitalList";
import { Search, Navigation } from "lucide-react";

// Dynamically import map to avoid SSR window errors
const Map = dynamic(() => import("../components/Map"), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-gray-100 flex items-center justify-center font-sans tracking-wide">Initializing ER Waze Engine...</div>
});

export default function Home() {
    const [userLocation, setUserLocation] = useState(null);
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedType, setSelectedType] = useState("");
    const [selectedHospital, setSelectedHospital] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchError, setSearchError] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        const term = searchQuery.toLowerCase().trim();
        
        // 1. Check if the hospital is already loaded in the top 25 map array
        const foundLocal = hospitals.find(h => h.name.toLowerCase().includes(term));
        
        if (foundLocal) {
            setSelectedHospital(foundLocal);
            setSearchError(false);
            return;
        } 
        
        // 2. If it's not in the map's current limited array, search the entire database
        try {
            const { data } = await axios.get('/api/search', { params: { q: term } });
            
            // Add the database result into our current array to render it on the map and side list
            const searchedHospital = {
                ...data,
                drive_time: "...", // Driving time will be calculated geometrically down the road or on map trace
                total_time: data.base_wait_time || 0
            };
            
            setHospitals(prev => [searchedHospital, ...prev]);
            setSelectedHospital(searchedHospital);
            setSearchError(false);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // Not found in entire database
                setSearchError(true);
                setTimeout(() => setSearchError(false), 3000);
            } else {
                console.error("Database search failed.", error);
            }
        }
    };

    // Set location to Alfaisal University female gate
    useEffect(() => {
        setUserLocation({ lat: 24.664448, lon: 46.680064 });
    }, []);

    const fetchHospitals = useCallback(async () => {
        if (!userLocation) return;

        setLoading(true);
        try {
            const { data } = await axios.get('/api/route', {
                params: {
                    lat: userLocation.lat,
                    lon: userLocation.lon,
                    type: selectedType
                }
            });
            setHospitals(data);
            if (data.length > 0) {
                setSelectedHospital(data[0]); // Auto-select winner
            }
        } catch (e) {
            console.error("Failed to fetch hospital routing:", e);
        } finally {
            setLoading(false);
        }
    }, [userLocation, selectedType]);

    // Fetch when location or filter changes
    useEffect(() => {
        fetchHospitals();
    }, [fetchHospitals]);

    return (
        <div className="h-screen w-full relative overflow-hidden font-sans">
            <Head>
                <title>ER Waze | Total Time to Care</title>
            </Head>

            {/* SEARCH AREA - Top Left */}
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                {/* Search Bar Input */}
                <div className="w-80 bg-white rounded-full shadow-md border border-gray-100 p-3 flex items-center gap-3">
                    <div className="text-gray-400"><Search size={20} /></div>
                    <input
                        type="text"
                        placeholder="Search location or symptom..."
                        className="flex-1 outline-none text-sm bg-transparent"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSearch();
                        }}
                    />
                    <div 
                        onClick={handleSearch}
                        className="text-[#1A73E8] p-1 bg-blue-50 rounded-full cursor-pointer hover:bg-blue-100 transition-colors"
                    >
                        <Navigation size={18} className="rotate-45" />
                    </div>
                </div>

                {/* Search Error Message */}
                <div 
                    className={`text-[#EA4335] bg-white/90 backdrop-blur px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-sm border border-red-50 self-start transition-opacity duration-300 ${searchError ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    Health Care Centre not Found
                </div>
            </div>

            <Triage
                selectedType={selectedType}
                onTypeSelect={setSelectedType}
            />

            <HospitalList
                hospitals={hospitals}
                loading={loading}
                onSelect={setSelectedHospital}
                selectedId={selectedHospital?.id}
            />

            <div className="absolute inset-0 z-0">
                <Map
                    userLocation={userLocation}
                    hospitals={hospitals}
                    selectedHospital={selectedHospital}
                    onSelectHospital={setSelectedHospital}
                    onMapDragEnd={() => { }} // Could trigger re-fetch in future iterations
                />
            </div>
        </div>
    );
}
