// Map3D.js

import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot } from "react-dom/client";
import { CONFIG, EXTRA_MARKERS } from "./constants";
import { coordKey, calculateDistance } from "./utils";
import { createGeojson } from "./geojson";
import { PinMarker } from "../PinMarker";
import SimpleAROverlay from "../ghost/SimpleAROverlay";

const Map3D = () => {
  // ----- 상태 및 ref -----
  const mapContainer = useRef(null);
  const map = useRef(null);
  const domMarkerMap = useRef(new Map());
  const hasCenteredOnUser = useRef(false);

  const [userLocation, setUserLocation] = useState(null);
  const [showARButton, setShowARButton] = useState(false);
  const [closestMarker, setClosestMarker] = useState(null);
  const [disabledMarkerTitles, setDisabledMarkerTitles] = useState([]);
  const [isARActive, setIsARActive] = useState(false);
  const [selectedMarkerData, setSelectedMarkerData] = useState(null);
  const [isWalkMode, setIsWalkMode] = useState(false);
  const [destinationPoint, setDestinationPoint] = useState(null);
  const routeReqRef = useRef(0);

  // ----- 지도 초기화 (최초) -----
  useEffect(() => {
    mapboxgl.accessToken = CONFIG.mapboxToken;
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [CONFIG.targetLng, CONFIG.targetLat],
      zoom: 15,
      pitch: 60,
      bearing: -17.6,
      antialias: true,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.current.on("load", () => {
      map.current.addSource("markers", {
        type: "geojson",
        data: createGeojson(),
        cluster: true,
        clusterMaxZoom: 17,
        clusterRadius: 50,
      });
      map.current.addLayer({
        id: "clusters", type: "circle", source: "markers",
        filter: ["has", "point_count"],
        paint: { "circle-color": "#3A8049", "circle-radius": ["step", ["get", "point_count"], 15, 7, 20, 15, 25] },
      });
      map.current.addLayer({
        id: "cluster-count", type: "symbol", source: "markers",
        filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
        paint: { "text-color": "#fff" },
      });

      updateDOMMarkers();
      ["move", "zoom", "idle"].forEach((event) =>
        map.current.on(event, updateDOMMarkers)
      );
    });

    // 위치 추적 (최초 한 번)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const userCoords = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(userCoords);
          if (map.current && !hasCenteredOnUser.current) {
            map.current.easeTo({ center: userCoords, zoom: 16, duration: 1800 });
            hasCenteredOnUser.current = true;
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }

    return () => {
      domMarkerMap.current.forEach((m) => m.marker.remove());
      domMarkerMap.current.clear();
      if (map.current) map.current.remove();
      map.current = null;
    };
  }, []);

  // ----- DOM 마커 관리 -----
  function updateDOMMarkers() {
    if (!map.current?.getSource("markers")) return;
    const features = map.current.querySourceFeatures("markers") || [];
    const singlePoints = features.filter(f => !f.properties.point_count);
    const newKeys = new Set();
    singlePoints.forEach(feature => {
      const coordArr = feature.geometry.coordinates;
      const key = coordKey(coordArr);
      const title = feature.properties?.title || "";
      const visuallyDisabled =
        isWalkMode && disabledMarkerTitles.includes(title); // 회색 처리
      const interactive =
        isWalkMode && !visuallyDisabled;

      newKeys.add(key);

      if (!domMarkerMap.current.has(key)) {
        const element = document.createElement("div");
        const root = createRoot(element);
        root.render(
          <PinMarker
            imageUrl={CONFIG.markerImageUrl}
            disabled={visuallyDisabled}
            interactive={interactive}
            onClick={() => handlePinMarkerClick(coordArr, feature)}
          />
        );
        const marker = new mapboxgl.Marker(element)
          .setLngLat(coordArr)
          .addTo(map.current);
        domMarkerMap.current.set(key, { marker, root, disabled: visuallyDisabled, interactive, title });
      } else {
        // 변화시 재렌더링
        const existing = domMarkerMap.current.get(key);
        if (
          existing.disabled !== visuallyDisabled ||
          existing.interactive !== interactive
        ) {
          existing.root.render(
            <PinMarker
              imageUrl={CONFIG.markerImageUrl}
              disabled={visuallyDisabled}
              interactive={interactive}
              onClick={() => handlePinMarkerClick(coordArr, feature)}
            />
          );
          existing.disabled = visuallyDisabled;
          existing.interactive = interactive;
        }
      }
    });
    Array.from(domMarkerMap.current.keys()).forEach(key => {
      if (!newKeys.has(key)) {
        const rec = domMarkerMap.current.get(key);
        rec.marker.remove();
        rec.root.unmount();
        domMarkerMap.current.delete(key);
      }
    });
  }

  // ----- 길찾기&경로 -----
  async function getRouteWithFixedLocation(fixedStartLocation, end) {
    if (!map.current) return;

    if (map.current.getSource("walk-route")) {
      map.current.removeLayer("walk-route");
      map.current.removeSource("walk-route");
    }
    setDestinationPoint(end);

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${fixedStartLocation[0]},${fixedStartLocation[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&overview=full&access_token=${CONFIG.mapboxToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!(data.routes?.length > 0)) {
        alert("경로를 찾지 못했습니다.");
        return;
      }
      const routeCoords = data.routes[0].geometry.coordinates;
      const routeLine = [fixedStartLocation, ...routeCoords, end];
      map.current.addSource("walk-route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: routeLine } }
      });
      map.current.addLayer({
        id: "walk-route",
        type: "line",
        source: "walk-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ff2d55", "line-width": 6, "line-opacity": 0.95 },
      });

      const bounds = routeLine.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(routeLine[0], routeLine[0])
      );
      map.current.fitBounds(bounds, { padding: 50 });
    } catch (e) {
      alert("길찾기 오류: " + e.message);
    }
  }

  function clearRoute() {
    if (map.current?.getSource("walk-route")) {
      map.current.removeLayer("walk-route");
      map.current.removeSource("walk-route");
    }
    setDestinationPoint(null);
  }

  // ----- 마커 클릭 -----
  function handlePinMarkerClick(coords, feature) {
    clearRoute();
    setDestinationPoint(coords);
    if (userLocation) {
      const fixedStartLocation = [...userLocation];
      getRouteWithFixedLocation(fixedStartLocation, coords);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const userCoords = [position.coords.longitude, position.coords.latitude];
          setUserLocation(userCoords);
          getRouteWithFixedLocation([...userCoords], coords);
        },
        error => { alert("위치 서비스를 사용할 수 없습니다."); },
        { enableHighAccuracy: true }
      );
    }
  }

  // ----- AR 버튼 조건: 100m 이내 -----
  useEffect(() => {
    if (!userLocation || !isWalkMode) { setShowARButton(false); setClosestMarker(null); return; }
    let nearest = null, minDist = Infinity;
    EXTRA_MARKERS.forEach((m) => {
      if (disabledMarkerTitles.includes(m.title)) return;
      const d = calculateDistance(userLocation[1], userLocation[0], m.lat, m.lng);
      if (d < minDist) { minDist = d; nearest = m; }
    });
    if (nearest && minDist <= 100) {
      setShowARButton(true);
      setClosestMarker(nearest);
    } else { setShowARButton(false); setClosestMarker(null); }
  }, [userLocation, disabledMarkerTitles, isWalkMode]);

  // ----- AR 모드 진입/종료 -----
  function handleARButtonClick() {
    if (!closestMarker) return;
    setSelectedMarkerData({
      coords: [closestMarker.lng, closestMarker.lat],
      title: closestMarker.title,
      description: closestMarker.description,
      imageUrl: CONFIG.markerImageUrl,
      id: closestMarker.title,
    });
    setIsARActive(true);
    setDisabledMarkerTitles((prev) => [...prev, closestMarker.title]);
    setClosestMarker(null);
  }
  function handleCloseAR() { setIsARActive(false); setSelectedMarkerData(null); }

  // ----- 산책 진행바/종료 -----
  const totalMarkerCount = EXTRA_MARKERS.length;
  const disabledCount = disabledMarkerTitles.length;
  const disabledPct = totalMarkerCount ? Math.round((disabledCount / totalMarkerCount) * 100) : 0;
  function handleGaugeStop() {
    setIsWalkMode(false);
    setShowARButton(false);
    setIsARActive(false);
    clearRoute();
    setClosestMarker(null);
    setDisabledMarkerTitles([]);
  }

  // ----- 렌더 -----
  return (
    <div
      className="map-container"
      style={{ width: "100%", height: "100vh", position: "relative" }}
    >
      <div
        ref={mapContainer}
        className="mapbox-container"
        style={{ width: "100%", height: "100%" }}
      />
      {!isWalkMode && (
        <button
          onClick={() => setIsWalkMode(true)}
          aria-label="산책 시작"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 24,
            zIndex: 1200,
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#3A8049",
            color: "#fff",
            border: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 0.3,
            cursor: "pointer",
          }}
        >
          Start
        </button>
      )}
      {showARButton && (
        <button
          onClick={handleARButtonClick}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translate(-50%, 0)",
            bottom: "calc(24px + env(safe-area-inset-bottom))",
            background: "linear-gradient(180deg, #ffffff 0%, #f3f3f3 100%)",
            color: "#111",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "50px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow:
              "0 10px 24px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(0,0,0,0.05)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: "140px",
            justifyContent: "center",
            position: "absolute",
            overflow: "hidden",
            willChange: "transform, box-shadow",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span style={{ fontSize: "16px" }}>📷</span>
          <span>AR 모드</span>
        </button>
      )}
      {isWalkMode && (
        <div
          style={{
            position: "absolute",
            top: "calc(16px + env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1200,
            width: "min(360px, calc(100% - 32px))",
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.95)",
            boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr auto",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <button
              onClick={handleGaugeStop}
              style={{
                height: 28,
                borderRadius: 6,
                border: "none",
                background: "#ff2d55",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.2,
                cursor: "pointer",
              }}
            >
              종료
            </button>
            <div
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "#333",
                fontWeight: 600,
              }}
            >
              {disabledCount} / {totalMarkerCount} ({disabledPct}%)
            </div>
            <span
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                background: "#E8F5E9",
                color: "#2E7D32",
                fontSize: 11,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              진행중
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "#e9ecef",
              overflow: "hidden",
            }}
            aria-label={`비활성화 ${disabledPct}%`}
            title={`비활성화 ${disabledPct}%`}
          >
            <div
              style={{
                width: `${disabledPct}%`,
                height: "100%",
                borderRadius: 999,
                background:
                  disabledPct < 50
                    ? "#3A8049"
                    : disabledPct < 80
                    ? "#FF9800"
                    : "#ff2d55",
                transition: "width 300ms ease",
              }}
            />
          </div>
        </div>
      )}
      <SimpleAROverlay
        isActive={isARActive}
        markerData={selectedMarkerData}
        onClose={handleCloseAR}
      />
    </div>
  );
};

export default Map3D;
