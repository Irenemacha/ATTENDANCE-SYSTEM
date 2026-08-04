"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  latitude: number;
  longitude: number;
  radius: number;
};

export default function SessionMap({ latitude, longitude, radius }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [latitude, longitude],
      zoom: 17,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      html: `<div style="background:#1a7a5c;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">📍</div>`,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([latitude, longitude], { icon }).addTo(map);

    L.circle([latitude, longitude], {
      radius,
      color: "#1a7a5c",
      fillColor: "#1a7a5c",
      fillOpacity: 0.1,
      weight: 2,
      dashArray: "4",
    }).addTo(map);

    instanceRef.current = map;

    return () => {
      map.remove();
      instanceRef.current = null;
    };
  }, [latitude, longitude, radius]);

  return <div ref={mapRef} className="h-[400px] w-full rounded-lg" />;
}
