"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function createPulseIcon(color = "#00D2FF") {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        position: relative;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 54px;
          height: 54px;
          border-radius: 999px;
          background: ${color}44;
        "></div>

        <div style="
          width: 40px;
          height: 40px;
          border-radius: 999px;
          background: white;
          border: 4px solid ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(0,0,0,0.35);
        ">
          <div style="
            width: 14px;
            height: 14px;
            border-radius: 999px;
            background: ${color};
            border: 2px solid white;
          "></div>
        </div>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
  });
}

const normalIcon = createPulseIcon("#00D2FF");
const teleopIcon = createPulseIcon("#56ab91");

export default function TaiwanMap({
  location,
  teleopMode,
  teleopPos,
  todayPath,
  onTeleopMove,
  recenterSignal,
  recenterTarget,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const polylineRef = useRef(null);
  const lastRecenterSignalRef = useRef(recenterSignal);

  // Create map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialPosition = location || {
      latitude: 23.5,
      longitude: 121.0,
    };

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([initialPosition.latitude, initialPosition.longitude], 8);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      polylineRef.current = null;
    };
  }, []);

  // Update active marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activePosition =
      teleopMode && teleopPos ? teleopPos : location;

    if (!activePosition?.latitude || !activePosition?.longitude) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    const marker = L.marker(
      [activePosition.latitude, activePosition.longitude],
      {
        icon: teleopMode ? teleopIcon : normalIcon,
        draggable: teleopMode,
      }
    ).addTo(map);

    if (teleopMode) {
      marker.on("dragend", () => {
        const next = marker.getLatLng();
        onTeleopMove(next.lat, next.lng);
      });
    }

    markerRef.current = marker;
  }, [location, teleopMode, teleopPos, onTeleopMove]);

  // Update route line.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const points = (todayPath || []).map((point) => [
      point.latitude,
      point.longitude,
    ]);

    if (points.length > 1) {
      polylineRef.current = L.polyline(points, {
        color: "#00D2FF",
        weight: 6,
        opacity: 0.9,
      }).addTo(map);
    }
  }, [todayPath]);

  // Recenter only when signal changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lastRecenterSignalRef.current === recenterSignal) return;
    lastRecenterSignalRef.current = recenterSignal;

    const activePosition =
      recenterTarget ||
      (teleopMode && teleopPos ? teleopPos : location);

    if (!activePosition?.latitude || !activePosition?.longitude) return;

    map.flyTo([activePosition.latitude, activePosition.longitude], 15, {
      animate: true,
      duration: 0.8,
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [recenterSignal, recenterTarget, teleopMode, teleopPos, location]);

  return <div ref={containerRef} className="h-full w-full" />;
}
