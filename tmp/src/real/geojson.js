// geojson.js

import { CONFIG, EXTRA_MARKERS } from "./constants";

export function createGeojson() {
  const baseFeatures = [
    {
      type: "Feature",
      properties: { id: "main", title: "전북대학교", description: "산책 프로젝트 출발지" },
      geometry: { type: "Point", coordinates: [CONFIG.targetLng, CONFIG.targetLat] },
    },
    ...EXTRA_MARKERS.map((marker, index) => ({
      type: "Feature",
      properties: { id: `spot_${index}`, title: marker.title, description: marker.description },
      geometry: { type: "Point", coordinates: [marker.lng, marker.lat] },
    })),
  ];
  return { type: "FeatureCollection", features: baseFeatures };
}
