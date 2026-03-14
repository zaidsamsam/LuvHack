import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// import "leaflet-routing-machine"; // We will add routing machine logic dynamically
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
    const routingControlRef = useRef(null);

    // Initialize routing when selected hospital changes
    useEffect(() => {
        if (!mapRef.current || !selectedHospital || !userLocation) return;

        const map = mapRef.current;

        // Clear existing route
        if (routingControlRef.current) {
            map.removeControl(routingControlRef.current);
        }

        try {
            // Create new routing control
            const LRM = require('leaflet-routing-machine');
            routingControlRef.current = L.Routing.control({
                waypoints: [
                    L.latLng(userLocation.lat, userLocation.lon),
                    L.latLng(selectedHospital.latitude, selectedHospital.longitude)
                ],
                show: false,
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true,
                showAlternatives: false,
                lineOptions: {
                    styles: [{ color: '#1A73E8', opacity: 0.8, weight: 6 }]
                },
                createMarker: function () { return null; } // Don't show default A/B markers
            }).addTo(map);
        } catch (e) {
            console.warn("Routing machine error:", e);
        }

        return () => {
            if (routingControlRef.current && map) {
                map.removeControl(routingControlRef.current);
            }
        };
    }, [selectedHospital, userLocation]);

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
                        />
                    );
                })}
            </MapContainer>
        </div>
    );
}
