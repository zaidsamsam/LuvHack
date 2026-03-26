import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";

function MapUpdater({ center }) {
    const map = useMap();
    const lat = center ? center[0] : null;
    const lng = center ? center[1] : null;

    useEffect(() => {
        if (lat !== null && lng !== null) {
            map.flyTo([lat, lng], 13, { animate: true, duration: 1 });
        }
    }, [lat, lng, map]);
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

                // Color mappings based on magnitudeOfDelay severity
                // 0: Unknown, 1: Minor, 2: Moderate, 3: Major, 4: Undefined (Blocked)
                const getTrafficColor = (magnitude) => {
                    const level = Number(magnitude);
                    if (level === 1) return '#FBBC04'; // Yellow (Minor Delay)
                    if (level === 2) return '#FA7B17'; // Orange (Moderate)
                    if (level >= 3) return '#EA4335'; // Red (Major/Blocked)
                    return '#34A853'; // Green (Clear/Unknown/Default)
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
                            color: getTrafficColor(section.magnitudeOfDelay)
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

    const mapCenter = userLocation ? [userLocation.lat, userLocation.lon] : [24.7136, 46.6753];

    // Riyadh bounding box to restrict panning
    const riyadhBounds = [
        [24.4, 46.4], // Southwest coordinates
        [25.0, 46.9]  // Northeast coordinates
    ];

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
                wheelPxPerZoomLevel={120}
                preferCanvas={true}
                style={{ height: "100%", width: "100%" }}
                ref={mapRef}
                zoomControl={false}
                maxBounds={riyadhBounds}
                maxBoundsViscosity={1.0}
                minZoom={10}
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


        </div>
    );
}
