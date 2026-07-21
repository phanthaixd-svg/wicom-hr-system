"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Bản đồ nền thật (OpenStreetMap) + tuyến GPS. Leaflet chỉ nạp phía client.
export default function RouteMap({ points }: { points: number[][] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || ref.current.dataset.init === "1") return;
      ref.current.dataset.init = "1";

      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const latlngs = points.map((p) => [p[0], p[1]] as [number, number]);
      const line = L.polyline(latlngs, { color: "#18E4A2", weight: 4, opacity: 0.95 }).addTo(map);
      L.circleMarker(latlngs[0], { radius: 6, weight: 2, color: "#0A2338", fillColor: "#18E4A2", fillOpacity: 1 }).addTo(map);
      L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, weight: 2, color: "#0A2338", fillColor: "#FFC45F", fillOpacity: 1 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [26, 26] });
      // Trong modal, container mới hiện -> ép Leaflet đo lại kích thước.
      const m = map;
      setTimeout(() => m.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      if (ref.current) delete ref.current.dataset.init;
    };
  }, [points]);

  return <div ref={ref} className="leaflet-wrap" />;
}
