"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function dotIcon(color) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:18px;
        height:18px;
        border-radius:999px;
        background:${color};
        border:4px solid white;
        box-shadow:0 8px 18px rgba(0,0,0,0.35);
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const startIcon = dotIcon("#2575FC");
const endIcon = dotIcon("#FF3B30");

export default function RoutePreviewMap({ start, end, routeCoords = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = start || { latitude: 23.7, longitude: 121 };

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    }).setView([center.latitude, center.longitude], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !start || !end) return;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];

    const startMarker = L.marker([start.latitude, start.longitude], {
      icon: startIcon,
    }).addTo(map);

    const endMarker = L.marker([end.latitude, end.longitude], {
      icon: endIcon,
    }).addTo(map);

    const points =
      routeCoords.length > 1
        ? routeCoords.map((point) => [point.latitude, point.longitude])
        : [
            [start.latitude, start.longitude],
            [end.latitude, end.longitude],
          ];

    const line = L.polyline(points, {
      color: "#00D2FF",
      weight: 5,
      opacity: 0.95,
    }).addTo(map);

    layersRef.current = [startMarker, endMarker, line];

    map.fitBounds(line.getBounds(), {
      padding: [28, 28],
      animate: true,
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 120);
  }, [start, end, routeCoords]);

  return <div ref={containerRef} className="h-full w-full" />;
}
