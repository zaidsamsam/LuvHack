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

    // Fetch location on mount
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                },
                (error) => {
                    console.error("Error getting location:", error);
                    // Fallback to Riyadh if declined
                    setUserLocation({ lat: 24.7136, lon: 46.6753 });
                }
            );
        } else {
            setUserLocation({ lat: 24.7136, lon: 46.6753 });
        }
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

            {/* SEARCH BAR CARD - Top Left */}
            <div className="absolute top-4 left-4 z-[1000] w-80 bg-white rounded-full shadow-md border border-gray-100 p-3 flex items-center gap-3">
                <div className="text-gray-400"><Search size={20} /></div>
                <input
                    type="text"
                    placeholder="Search location or symptom..."
                    className="flex-1 outline-none text-sm bg-transparent"
                />
                <div className="text-[#1A73E8] p-1 bg-blue-50 rounded-full cursor-pointer hover:bg-blue-100 transition-colors">
                    <Navigation size={18} className="rotate-45" />
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
