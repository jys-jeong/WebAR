import React, { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot } from "react-dom/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot } from "@fortawesome/free-solid-svg-icons";

const targetLng = 127.1465;
const targetLat = 35.8477;
const markerImageUrl = "/image.jpg";
const extraMarkers = [
  { lng: 127.14764312652059, lat: 35.84418165482111 },
  { lng: 127.14613156528183, lat: 35.84964804127036 },
  { lng: 127.14214296827205, lat: 35.845700639080235 },
  { lng: 127.14984840092337, lat: 35.85156432205935 },
  { lng: 127.14247370527909, lat: 35.84926823721113 },
  { lng: 127.14692305866805, lat: 35.852323070669286 },
  { lng: 127.14215263696799, lat: 35.846070049809214 },
  { lng: 127.14206556949755, lat: 35.84662512473487 },
];

const geojson = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [targetLng, targetLat] } },
    ...extraMarkers.map((m, i) => ({
      type: "Feature",
      properties: { id: `e${i}` }, // 고유 id 삽입 (diff 관리용)
      geometry: { type: "Point", coordinates: [m.lng, m.lat] },
    })),
  ],
};

const PinMarker = ({ imageUrl }) => (
  <div style={{
    position: "relative", width: "54px", height: "70px", pointerEvents: "none",
    display: "flex", justifyContent: "center", alignItems: "flex-start",
  }}>
    <FontAwesomeIcon
      icon={faLocationDot}
      style={{
        fontSize: "64px", color: "#8BC96E",
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.17))",
        position: "absolute", left: 0, top: 0, zIndex: 0
      }}
    />
    <img
      src={imageUrl}
      alt="핀"
      style={{
        position: "absolute", left: "20px", top: "5px", width: "35px", height: "35px",
        borderRadius: "50%", objectFit: "cover", border: "2.5px solid #fff",
        boxShadow: "0 1.5px 4px rgba(0,0,0,0.13)", zIndex: 2
      }}
    />
  </div>
);

mapboxgl.accessToken = "pk.eyJ1IjoiamVvbmd5ZXNlb25nIiwiYSI6ImNtZHJldDNkODBmMW4yaXNhOGE1eWg4ODcifQ.LNsrvvxhCIJ6Lvwc9c0tVg";

function coordKey(coord) {
  // "lng,lat" 과 같이 문자열 키로 관리
  return `${coord[0].toFixed(8)},${coord[1].toFixed(8)}`;
}

const Map3D = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  // key: "lng,lat", value: mapboxgl.Marker 인스턴스
  const domMarkerMap = useRef(new Map());

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [targetLng, targetLat],
      zoom: 15,
      pitch: 60,
      bearing: -17.6,
      antialias: true,
    });

    // DOM 마커를 diff(변경점) 기반으로 update
    function updateDOMMarkers() {
      if (!map.current.getSource("markers")) return;
      const features = map.current.querySourceFeatures("markers") || [];

      // 현재 단일 포인트만 추출
      const singlePoints = features.filter(f => !f.properties.point_count);

      // Map으로 관리: set에는 새로 보일 marker 좌표, remove할 것은 diff로 체크
      const newKeys = new Set();
      singlePoints.forEach(f => {
        const coordArr = f.geometry.coordinates;
        const key = coordKey(coordArr);
        newKeys.add(key);
        if (!domMarkerMap.current.has(key)) {
          // 없는 마커만 추가
          const el = document.createElement("div");
          createRoot(el).render(<PinMarker imageUrl={markerImageUrl} />);
          const marker = new mapboxgl.Marker(el).setLngLat(coordArr).addTo(map.current);
          domMarkerMap.current.set(key, marker);
        }
      });
      // 사라진 단일 포인트 마커 remove
      Array.from(domMarkerMap.current.keys()).forEach(key => {
        if (!newKeys.has(key)) {
          const m = domMarkerMap.current.get(key);
          m.remove();
          domMarkerMap.current.delete(key);
        }
      });
    }

    map.current.on("load", () => {
      map.current.addSource("markers", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.current.addLayer({
        id: "clusters",
        type: "circle",
        source: "markers",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#8BC96E",
          "circle-radius": ["step", ["get", "point_count"], 22, 7, 31, 15, 40],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#fff",
        },
      });
      map.current.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "markers",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 16,
        },
      });

      updateDOMMarkers();
      map.current.on("move", updateDOMMarkers);
      map.current.on("zoom", updateDOMMarkers);
    });

    // Clean-up(메모리 누수 방지)
    return () => {
      domMarkerMap.current.forEach(m => m.remove());
      domMarkerMap.current.clear();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default Map3D;
