import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";

function MapUpdater({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 13, { animate: true, duration: 1 });
        }
    }, [center, map]);
    return null;
}

function MapEvents({ onDragEnd }) {
    useMapEvents({
        dragend: () => onDragEnd(),
    });
    return null;
}

export default function Map({ userLocation, hospitals, selectedHospital, onSelectHospital, onMapDragEnd }) {
    const mapRef = useRef(null);
    const [routeSegments, setRouteSegments] = useState([]);

    const fetchRouteGeometry = useCallback(async () => {
        if (!userLocation || !selectedHospital) {
            setRouteSegments([]);
            return;
        }

        try {
            const { data } = await axios.get('/api/route_geometry', {
                params: {
                    startLat: userLocation.lat,
                    startLon: userLocation.lon,
                    endLat: selectedHospital.latitude,
                    endLon: selectedHospital.longitude
                }
            });

            if (data && data.points && data.sections) {
                const segments = [];
                const sections = data.sections;

                // Color mappings based on 'simpleCategory'
                const colorMap = {
                    'JAM': '#EA4335',     // Red
                    'HEAVY': '#FA7B17',   // Orange
                    'MODERATE': '#FBBC04', // Yellow
                    'UNKNOWN': '#34A853', // Default to Green if unknown
                };

                // Create full base segment array initially as green
                let currentStartIndex = 0;

                // TomTom provides sections that override the base free-flow speed
                // Some traffic sections overlay the points array between startPointIndex and endPointIndex
                
                // Keep track of which points are colored differently
                const styledSegments = [];
                let lastEndIndex = 0;

                sections.forEach(section => {
                    if (section.sectionType === 'TRAFFIC') {
                        // Draw the free-flow part BEFORE this traffic section
                        if (section.startPointIndex > lastEndIndex) {
                            styledSegments.push({
                                positions: data.points.slice(lastEndIndex, section.startPointIndex + 1),
                                color: '#34A853' // Green
                            });
                        }

                        // Draw the traffic section
                        styledSegments.push({
                            positions: data.points.slice(section.startPointIndex, section.endPointIndex + 1),
                            color: colorMap[section.simpleCategory] || '#34A853'
                        });

                        lastEndIndex = section.endPointIndex;
                    }
                });

                // Draw any remaining free-flow part at the end
                if (lastEndIndex < data.points.length - 1) {
                    styledSegments.push({
                        positions: data.points.slice(lastEndIndex),
                        color: '#34A853' // Green
                    });
                }
                
                // If there were NO traffic sections at all, the whole route should be green.
                if (sections.filter(s => s.sectionType === 'TRAFFIC').length === 0) {
                     styledSegments.push({
                         positions: data.points,
                         color: '#34A853'  // Green
                     });
                }

                setRouteSegments(styledSegments);

                // Fit map bounds to the route
                if (mapRef.current) {
                    const bounds = L.latLngBounds(data.points);
                    mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
                }
            }

        } catch (e) {
            console.error("Failed to fetch route geometry:", e);
        }
    }, [userLocation, selectedHospital]);

    // Initial fetch and dependency trigger
    useEffect(() => {
        fetchRouteGeometry();
    }, [fetchRouteGeometry]);

    // Set 2-minute refresh interval
    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchRouteGeometry();
        }, 120000); // 2 minutes

        return () => clearInterval(intervalId);
    }, [fetchRouteGeometry]);

    const mapCenter = userLocation ? [userLocation.lat, userLocation.lon] : [41.8781, -87.6298];

    // Custom icons based on hospital ranks
    const getIcon = (hospital, isWinner, isSelected) => {
        let iconUrl = "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png";
        if (isWinner) {
            iconUrl = "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png";
        }
        if (isSelected && !isWinner) {
            iconUrl = "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png";
        }

        return new L.Icon({
            iconUrl,
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
            iconSize: isSelected ? [35, 56] : [25, 41],
            iconAnchor: isSelected ? [17, 56] : [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
    };

    return (
        <div className="h-full w-full z-0 font-sans">
            <MapContainer
                center={mapCenter}
                zoom={13}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
                ref={mapRef}
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />

                {/* TomTom Traffic Layer Implementation (Optional visual) */}
                {process.env.NEXT_PUBLIC_TOMTOM_KEY && (
                    <TileLayer
                        url={`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_TOMTOM_KEY}`}
                        opacity={0.6}
                        maxZoom={22}
                        attribution="&copy; TomTom"
                    />
                )}

                <MapUpdater center={userLocation ? [userLocation.lat, userLocation.lon] : null} />
                <MapEvents onDragEnd={onMapDragEnd} />

                {userLocation && (
                    <>
                        <Circle
                            center={[userLocation.lat, userLocation.lon]}
                            radius={100000}
                            pathOptions={{ color: '#1A73E8', fillOpacity: 0.1, opacity: 0.5, weight: 2 }}
                        />
                        <Marker
                            position={[userLocation.lat, userLocation.lon]}
                            icon={new L.Icon({
                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowSize: [41, 41]
                            })}
                        />
                    </>
                )}

                {hospitals && hospitals.map((hospital, index) => {
                    const isWinner = index === 0;
                    const isSelected = selectedHospital?.id === hospital.id;

                    return (
                        <Marker
                            key={hospital.id}
                            position={[hospital.latitude, hospital.longitude]}
                            icon={getIcon(hospital, isWinner, isSelected)}
                            eventHandlers={{
                                click: () => onSelectHospital(hospital),
                            }}
                            zIndexOffset={isWinner ? 100 : 0}
                        />
                    );
                })}

                {/* Render Dynamic Traffic Route Segments */}
                {routeSegments.map((segment, idx) => (
                    <Polyline
                        key={idx}
                        positions={segment.positions}
                        pathOptions={{ 
                            color: segment.color, 
                            weight: 8, 
                            opacity: 0.85, 
                            lineCap: 'round', 
                            lineJoin: 'round' 
                        }}
                    />
                ))}
            </MapContainer>

            {/* Live Traffic Legend Overlay */}
            {selectedHospital && (
                <div className="absolute bottom-6 left-6 z-[1000] bg-white rounded-xl shadow-lg border border-gray-100 p-3 pr-4 flex items-center gap-4">
                    <div className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 flex items-center gap-1 rounded uppercase tracking-wider">
                       Live Traffic
                    </div>
                    <div className="flex gap-3 text-xs font-bold font-sans text-gray-700">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#34A853]"></div> Clear
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FBBC04]"></div> Busy
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#EA4335]"></div> Jammed
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
