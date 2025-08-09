import React, { useRef, useEffect, useState, Suspense } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot } from "react-dom/client";
import { PinMarker } from "./PinMarker";
// import SimpleAROverlay from "./ghost/SimpleAROverlay"; // ← 제거
import ARButton from "./ARButton";

// 🔹 AR 오버레이 lazy-load
const SimpleAROverlay = React.lazy(() => import("./ghost/SimpleAROverlay"));

// 상수 정의
export const CONFIG = {
  targetLng: 127.1465,
  targetLat: 35.8477,
  markerImageUrl: "/image.jpg",
  mapboxToken:
    "pk.eyJ1IjoiamVvbmd5ZXNlb25nIiwiYSI6ImNtZHJldDNkODBmMW4yaXNhOGE1eWg4ODcifQ.LNsrvvxhCIJ6Lvwc9c0tVg",
};

// const EXTRA_MARKERS = [...]  // (생략: 기존 주석 유지)

const MARKER_CENTER = { lng: 126.82287685, lat: 35.18376162 };

// 기준 좌표 중심으로 10개 마커 랜덤 배치 (약 100~200m 반경)
export const EXTRA_MARKERS = [
  { lng: MARKER_CENTER.lng + 0.0012, lat: MARKER_CENTER.lat + 0.001,  title: "커피마을", description: "향긋한 커피가 있는 곳" },
  { lng: MARKER_CENTER.lng - 0.0011, lat: MARKER_CENTER.lat - 0.0007, title: "헬스존", description: "건강을 위한 헬스장" },
  { lng: MARKER_CENTER.lng + 0.0008, lat: MARKER_CENTER.lat - 0.0012, title: "피크닉장", description: "야외 피크닉 명소" },
  { lng: MARKER_CENTER.lng - 0.0009, lat: MARKER_CENTER.lat + 0.0005, title: "놀이터", description: "아이들이 뛰노는 놀이터" },
  { lng: MARKER_CENTER.lng + 0.0015, lat: MARKER_CENTER.lat + 0.0006, title: "전망대", description: "넓은 경치를 볼 수 있는 전망대" },
  { lng: MARKER_CENTER.lng - 0.0013, lat: MARKER_CENTER.lat + 0.0014, title: "사진스팟", description: "인생샷 명소" },
  { lng: MARKER_CENTER.lng + 0.0006, lat: MARKER_CENTER.lat - 0.0008, title: "문화의 거리", description: "지역 문화 예술 공간" },
  { lng: MARKER_CENTER.lng - 0.0017, lat: MARKER_CENTER.lat - 0.0004, title: "쉼터", description: "잔디와 벤치가 있는 쉼터" },
  { lng: MARKER_CENTER.lng + 0.0013, lat: MARKER_CENTER.lat - 0.0005, title: "맛집거리", description: "다양한 음식점이 모인 거리" },
  { lng: MARKER_CENTER.lng - 0.0004, lat: MARKER_CENTER.lat + 0.0017, title: "산책길", description: "산책과 운동 겸하기 좋은 길" },
];

mapboxgl.accessToken = CONFIG.mapboxToken;
const coordKey = (coord) => `${coord[0].toFixed(8)},${coord[1].toFixed(8)}`;

// Haversine 거리 (m)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const Map3D = () => {
  // Refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const domMarkerMap = useRef(new Map());
  const geolocateControl = useRef(null);
  const watchId = useRef(null);
  const hasCenteredOnUser = useRef(false);
  const isInitialized = useRef(false);

  // 🔹 rAF 스로틀링용
  const rafId = useRef(null);
  const scheduleMarkerUpdateRef = useRef(null);

  // 🔹 AR 사전 프리로드 1회
  const arPrefetchedRef = useRef(false);

  // 🔹 GPS 노이즈 컷 기준 저장
  const lastLocRef = useRef(null);
  const lastTsRef = useRef(0);

  // State
  const [userLocation, setUserLocation] = useState(null);
  const [showARButton, setShowARButton] = useState(false);
  const [closestMarker, setClosestMarker] = useState(null);

  const [disabledMarkerTitles, setDisabledMarkerTitles] = useState([]);
  const [isARActive, setIsARActive] = useState(false);
  const [selectedMarkerData, setSelectedMarkerData] = useState(null);

  const disabledTitlesRef = useRef([]);
  const [isWalkMode, setIsWalkMode] = useState(false);
  const isWalkModeRef = useRef(false);
  const routeReqRef = useRef(0);

  const totalMarkerCount = EXTRA_MARKERS.length;
  const disabledCount = React.useMemo(() => {
    const set = new Set(disabledMarkerTitles);
    return EXTRA_MARKERS.reduce((acc, m) => acc + (set.has(m.title) ? 1 : 0), 0);
  }, [disabledMarkerTitles]);
  const disabledPct = totalMarkerCount ? Math.round((disabledCount / totalMarkerCount) * 100) : 0;

  useEffect(() => {
    isWalkModeRef.current = isWalkMode;
    scheduleMarkerUpdate(); // 🔹 rAF 스로틀: 모드 바뀔 때
  }, [isWalkMode]);

  useEffect(() => {
    disabledTitlesRef.current = disabledMarkerTitles;
    scheduleMarkerUpdate(); // 🔹 rAF 스로틀: 비활성 목록 바뀔 때
  }, [disabledMarkerTitles]);

  // 가벼운 로그
  const mobileLog = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

  // 🔹 rAF 스로틀링 스케줄러
  const scheduleMarkerUpdate = () => {
    if (!scheduleMarkerUpdateRef.current) {
      scheduleMarkerUpdateRef.current = () => {
        if (rafId.current) return;
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          updateDOMMarkers();
        });
      };
    }
    scheduleMarkerUpdateRef.current();
  };

  function getClosestMarkerAndDistance(userLoc, markers) {
    if (!userLoc || markers.length === 0) return { nearest: null, distance: null };
    let minDist = Infinity;
    let nearest = null;
    for (const m of markers) {
      const d = calculateDistance(userLoc[1], userLoc[0], m.lat, m.lng);
      if (d < minDist) { minDist = d; nearest = m; }
    }
    return { nearest, distance: nearest ? Math.round(minDist) : null };
  }

  useEffect(() => {
    if (!userLocation) {
      setClosestMarker(null);
      setShowARButton(false);
      return;
    }

    const activeMarkers = EXTRA_MARKERS.filter(
      (m) => !disabledMarkerTitles.includes(m.title)
    );

    const { nearest, distance } = getClosestMarkerAndDistance(
      userLocation, activeMarkers
    );
    const inRange = isWalkMode && nearest && distance <= 100;

    // 🔹 근접 시 AR 모듈 사전 프리로드 (최초 1회)
    if (inRange && !arPrefetchedRef.current) {
      import("./ghost/SimpleAROverlay");
      arPrefetchedRef.current = true;
    }

    setClosestMarker(inRange ? nearest : null);
    setShowARButton(!!inRange);

    mobileLog(
      inRange
        ? `가장 가까운 활성 마커: ${nearest.title} (${distance}m)`
        : `100m 내 활성 마커 없음`
    );
  }, [userLocation, disabledMarkerTitles, isWalkMode]);

  const centerMapToUserLocation = (userCoords, zoomLevel = 16) => {
    if (map.current && !hasCenteredOnUser.current) {
      map.current.easeTo({ center: userCoords, zoom: zoomLevel, duration: 2000 });
      hasCenteredOnUser.current = true;
      mobileLog(`지도가 사용자 위치로 센터링됨: [${userCoords[0].toFixed(6)}, ${userCoords[1].toFixed(6)}]`);
    }
  };

  // 🔹 GPS watchPosition with 노이즈 컷(5m/0.8s)
  const startLocationTracking = () => {
    mobileLog("위치 추적 시작 시도...");
    if (!navigator.geolocation) {
      mobileLog("브라우저가 위치 서비스를 지원하지 않습니다");
      return;
    }
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const userCoords = [longitude, latitude];

        const now = performance.now();
        const movedEnough =
          !lastLocRef.current ||
          calculateDistance(
            lastLocRef.current[1], lastLocRef.current[0],
            userCoords[1], userCoords[0]
          ) >= 5; // ≥ 5m
        const timeEnough = now - lastTsRef.current >= 800; // ≥ 0.8s

        if (!movedEnough && !timeEnough) return; // 🔹 노이즈 컷

        lastLocRef.current = userCoords;
        lastTsRef.current = now;

        setUserLocation(userCoords);
        if (map.current && map.current.isStyleLoaded()) {
          centerMapToUserLocation(userCoords);
        }
      },
      (error) => {
        const msg =
          error.code === error.PERMISSION_DENIED ? "권한 거부" :
          error.code === error.POSITION_UNAVAILABLE ? "위치 사용 불가" :
          error.code === error.TIMEOUT ? "요청 시간 초과" : "위치 서비스 오류";
        mobileLog(`${msg}: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const stopLocationTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    mobileLog("위치 추적 중지됨");
  };

  const createGeojson = (excludeDestination = null) => {
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

    if (excludeDestination) {
      return {
        type: "FeatureCollection",
        features: baseFeatures.filter((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const [dlng, dlat] = excludeDestination;
          return !(Math.abs(lng - dlng) < 0.000001 && Math.abs(lat - dlat) < 0.000001);
        }),
      };
    }
    return { type: "FeatureCollection", features: baseFeatures };
  };

  const safeRemoveSourceAndLayers = (sourceId) => {
    if (!map.current) return;
    try {
      const layerIds = { "walk-route": ["walk-route"], markers: ["clusters", "cluster-count"] };
      (layerIds[sourceId] || []).forEach((layerId) => {
        if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      });
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
    } catch (e) {
      mobileLog(`소스 제거 중 오류(무시): ${e.message}`);
    }
  };

  const initializeMap = (center) => {
    if (mapContainer.current) mapContainer.current.innerHTML = "";
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center, zoom: 15, pitch: 60, bearing: -17.6,
      antialias: true,
      preserveDrawingBuffer: true,
      renderWorldCopies: false,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }),
      "bottom-right"
    );

    geolocateControl.current = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      trackUserLocation: true, showUserHeading: true, showAccuracyCircle: true,
    });

    map.current.addControl(geolocateControl.current, "bottom-right");

    geolocateControl.current.on("geolocate", (e) => {
      const userCoords = [e.coords.longitude, e.coords.latitude];
      setUserLocation(userCoords);
      centerMapToUserLocation(userCoords);
      mobileLog(`Geolocate 위치 획득: [${userCoords[0].toFixed(6)}, ${userCoords[1].toFixed(6)}]`);
    });

    geolocateControl.current.on("error", (e) => {
      mobileLog(`Geolocate 오류: ${e.message}`);
    });

    map.current.on("load", () => {
      try {
        mobileLog("지도 로드 완료, 레이어 설정 시작");
        setupMapLayers();

        setTimeout(() => {
          geolocateControl.current?.trigger();
          setTimeout(() => startLocationTracking(), 2000);
        }, 1000);
      } catch (error) {
        mobileLog(`로드 후 초기화 오류: ${error.message}`);
      }
    });

    map.current.on("error", (e) => {
      mobileLog(`Mapbox 에러: ${e.message}`);
    });
  };

  useEffect(() => {
    if (isInitialized.current || map.current) return;
    isInitialized.current = true;

    if (navigator.geolocation) {
      mobileLog("초기 사용자 위치 요청...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userCoords = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(userCoords);
          mobileLog(`초기 위치로 지도 초기화: [${userCoords[0].toFixed(6)}, ${userCoords[1].toFixed(6)}]`);
          initializeMap(userCoords);
          hasCenteredOnUser.current = true;
        },
        (error) => {
          mobileLog(`초기 위치 실패, 기본 좌표로 초기화: ${error.message}`);
          initializeMap([CONFIG.targetLng, CONFIG.targetLat]);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    } else {
      mobileLog("위치 서비스 미지원, 기본 좌표로 초기화");
      initializeMap([CONFIG.targetLng, CONFIG.targetLat]);
    }

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);

      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      domMarkerMap.current.forEach((rec) => {
        rec?.marker?.remove?.();
        rec?.root?.unmount?.();
      });
      domMarkerMap.current.clear();

      if (map.current) {
        try {
          map.current.off("click", "clusters", handleClusterClick);
          ["move", "zoom", "idle"].forEach((ev) =>
            map.current.off(ev, scheduleMarkerUpdateRef.current || updateDOMMarkers)
          );
          if (geolocateControl.current) map.current.removeControl(geolocateControl.current);
        } catch (e) {}
        map.current.remove();
        map.current = null;
      }

      isInitialized.current = false;
      mobileLog("지도 컴포넌트 정리 완료");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRouteWithFixedLocation = async (fixedStartLocation, end) => {
    if (!map.current || !map.current.isStyleLoaded()) {
      mobileLog("스타일 미로딩: idle 이후 재시도");
      map.current.once("idle", () =>
        getRouteWithFixedLocation([...fixedStartLocation], [...end])
      );
      return;
    }

    const myId = ++routeReqRef.current;
    mobileLog(`route req #${myId} 시작`);

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${fixedStartLocation[0]},${fixedStartLocation[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&overview=full&access_token=${CONFIG.mapboxToken}`;
      const res = await fetch(url);
      const data = await res.json();
      mobileLog(`route req #${myId}: http=${res.status} code=${data?.code}`);

      if (res.status !== 200 || data?.code !== "Ok" || !data?.routes?.length) {
        mobileLog(`route req #${myId}: 경로 없음/에러`);
        alert("경로를 찾지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (myId !== routeReqRef.current) {
        mobileLog(`route req #${myId}: stale 응답, 스킵`);
        return;
      }

      safeRemoveSourceAndLayers("walk-route");

      const routeData = data.routes[0];
      const routeCoords = routeData.geometry.coordinates;
      const enhancedRoute = [fixedStartLocation, ...routeCoords, end];
      const filteredRoute = enhancedRoute.filter((coord, i) => {
        if (i === 0) return true;
        const p = enhancedRoute[i - 1];
        const dx = coord[0] - p[0];
        const dy = coord[1] - p[1];
        return Math.sqrt(dx * dx + dy * dy) > 0.00001;
      });

      map.current.addSource("walk-route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: filteredRoute } },
      });
      map.current.addLayer({
        id: "walk-route",
        type: "line",
        source: "walk-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ff2d55", "line-width": 6, "line-opacity": 0.95 },
      });

      const bounds = filteredRoute.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(filteredRoute[0], filteredRoute[0])
      );
      map.current.fitBounds(bounds, { padding: 50 });
    } catch (e) {
      mobileLog(`❌ route req #${myId} 오류: ${e.message}`);
      alert("길찾기 중 오류가 발생했습니다.");
    } finally {}
  };

  const handleGaugeStop = () => {
    setIsWalkMode(false);
    setShowARButton(false);
    setIsARActive(false);
    clearRoute();
    setClosestMarker(null);
  };

  const getRoute = async (end) => {
    if (!userLocation) {
      mobileLog("❌ getRoute 호출: userLocation 없음");
      alert("사용자 위치를 찾을 수 없습니다. 위치 서비스를 활성화해주세요.");
      return;
    }
    const fixedLocation = [...userLocation];
    mobileLog("getRoute: 현재 위치 고정");
    return getRouteWithFixedLocation(fixedLocation, end);
  };

  const clearRoute = () => {
    safeRemoveSourceAndLayers("walk-route");
    mobileLog("경로 초기화 완료 (마커 유지)");
  };

  const handlePinMarkerClick = (coords) => {
    clearRoute();
    mobileLog(`마커 클릭: [${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}]`);

    if (userLocation) {
      const fixedStartLocation = [...userLocation];
      mobileLog(`위치 고정: [${fixedStartLocation[0].toFixed(6)}, ${fixedStartLocation[1].toFixed(6)}]`);
      getRouteWithFixedLocation(fixedStartLocation, coords);
    } else {
      mobileLog("❌ 사용자 위치 없음 - 재요청");
      if (!navigator.geolocation) return alert("이 브라우저는 위치 서비스를 지원하지 않습니다.");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = [position.coords.longitude, position.coords.latitude];
          const fixedStartLocation = [...userCoords];
          setUserLocation(userCoords);
          mobileLog(`✅ 위치 재획득 및 고정: [${fixedStartLocation[0].toFixed(6)}, ${fixedStartLocation[1].toFixed(6)}]`);
          setTimeout(() => getRouteWithFixedLocation(fixedStartLocation, coords), 100);
        },
        (error) => {
          mobileLog(`❌ 위치 재획득 실패: ${error.message}`);
          alert(`위치 서비스 오류: ${error.message}\n\n해결방법:\n1. 브라우저 설정에서 위치 권한 허용\n2. 페이지 새로고침`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const handleARButtonClick = () => {
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
  };

  const handleCloseAR = () => {
    setIsARActive(false);
    setSelectedMarkerData(null);
    mobileLog("AR 오버레이 종료");
  };

  const handleClusterClick = (event) => {
    const features = map.current.queryRenderedFeatures(event.point, { layers: ["clusters"] });
    if (!features.length) return;

    const { cluster_id: clusterId, point_count: pointCount } = features[0].properties;
    const coordinates = features[0].geometry.coordinates.slice();

    mobileLog(`클러스터 클릭: ${pointCount}개`);

    map.current.getSource("markers").getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      const shouldZoom = window.confirm(`클러스터에 ${pointCount}개의 마커가 있습니다.\n확대하시겠습니까?`);
      if (shouldZoom) {
        map.current.easeTo({ center: coordinates, zoom });
        mobileLog(`클러스터 확대: zoom ${zoom}`);
      } else {
        alert(`클러스터 정보\n마커 개수: ${pointCount}개\n좌표: ${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}`);
      }
    });
  };

  const updateDOMMarkers = () => {
    if (!map.current?.getSource("markers")) return;
    try {
      const features = map.current.querySourceFeatures("markers") || [];
      const singlePoints = features.filter((f) => !f.properties.point_count);
      const newKeys = new Set();

      singlePoints.forEach((feature) => {
        const coordArr = feature.geometry.coordinates;
        const key = coordKey(coordArr);
        const title = feature.properties?.title || "";

        const visuallyDisabled = isWalkModeRef.current && disabledTitlesRef.current.includes(title);
        const interactive = isWalkModeRef.current && !visuallyDisabled;

        newKeys.add(key);

        const existing = domMarkerMap.current.get(key);
        if (!existing) {
          const el = document.createElement("div");
          const root = createRoot(el);
          root.render(
            <PinMarker
              imageUrl={CONFIG.markerImageUrl}
              disabled={visuallyDisabled}
              interactive={interactive}
              onClick={() => handlePinMarkerClick(coordArr, feature)}
            />
          );
          const marker = new mapboxgl.Marker(el).setLngLat(coordArr).addTo(map.current);
          domMarkerMap.current.set(key, { marker, root, disabled: visuallyDisabled, interactive, title });
        } else {
          if (existing.disabled !== visuallyDisabled || existing.interactive !== interactive) {
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

      Array.from(domMarkerMap.current.keys()).forEach((key) => {
        if (!newKeys.has(key)) {
          const rec = domMarkerMap.current.get(key);
          rec.marker.remove();
          rec.root.unmount();
          domMarkerMap.current.delete(key);
        }
      });
    } catch (e) {
      mobileLog(`DOM 마커 업데이트 오류: ${e.message}`);
    }
  };

  const setupMapLayers = () => {
    if (!map.current) return;
    try {
      safeRemoveSourceAndLayers("markers");

      map.current.addSource("markers", {
        type: "geojson",
        data: createGeojson(),
        cluster: true,
        clusterMaxZoom: 17,
        clusterRadius: 50,
      });

      map.current.addLayer({
        id: "clusters",
        type: "circle",
        source: "markers",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#3A8049",
          "circle-radius": ["step", ["get", "point_count"], 15, 7, 20, 15, 25],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#3A8049",
          "circle-pitch-scale": "viewport",
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
          "text-size": 12,
          "text-pitch-alignment": "viewport",
          "text-rotation-alignment": "viewport",
        },
        paint: { "text-color": "#fff" },
      });

      map.current.on("click", "clusters", handleClusterClick);
      map.current.on("mouseenter", "clusters", () => (map.current.getCanvas().style.cursor = "pointer"));
      map.current.on("mouseleave", "clusters", () => (map.current.getCanvas().style.cursor = ""));

      // 🔹 move/zoom/idle → rAF 스로틀 업데이트
      ["move", "zoom", "idle"].forEach((event) => {
        map.current.on(event, scheduleMarkerUpdateRef.current || scheduleMarkerUpdate);
      });

      // 🔹 소스 로드 완료 시에도 스로틀 업데이트
      const handleSourceData = (e) => {
        if (e.sourceId === "markers" && e.isSourceLoaded) {
          scheduleMarkerUpdate();
        }
      };
      map.current.on("sourcedata", handleSourceData);

      // 3D Buildings (기존과 동일)
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"]
      )?.id;

      map.current.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "height"]],
            "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "min_height"]],
            "fill-extrusion-opacity": 0.6,
          },
        },
        labelLayerId
      );

      // 최초 1회 갱신
      scheduleMarkerUpdate();

      mobileLog("지도 레이어 설정 완료");
    } catch (error) {
      mobileLog(`레이어 설정 오류: ${error.message}`);
    }
  };

  return (
    <div className="map-container" style={{ width: "100%", height: "100vh", position: "relative" }}>
      <div ref={mapContainer} className="mapbox-container" style={{ width: "100%", height: "100%" }} />

      {!isWalkMode && (
        <button
          onClick={() => setIsWalkMode(true)}
          aria-label="산책 시작"
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            bottom: 24, zIndex: 1200, width: 64, height: 64, borderRadius: "50%",
            background: "#3A8049", color: "#fff", border: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)", fontWeight: 800, fontSize: 14, letterSpacing: 0.3, cursor: "pointer",
          }}
        >
          Start
        </button>
      )}

      {/* 조건부 AR 버튼 */}
      {showARButton && <ARButton onClick={handleARButtonClick} />}

      {/* 상단 진행 박스 (기존과 동일) */}
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
          <div style={{ display: "grid", gridTemplateColumns: "72px 1fr auto", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => {
                setIsWalkMode(false);
                setShowARButton(false);
                setIsARActive(false);
                safeRemoveSourceAndLayers("walk-route");
                setClosestMarker(null);
              }}
              style={{ height: 28, borderRadius: 6, border: "none", background: "#ff2d55", color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: 0.2, cursor: "pointer" }}
            >
              종료
            </button>
            <div style={{ textAlign: "center", fontSize: 12, color: "#333", fontWeight: 600 }}>
              {disabledCount} / {totalMarkerCount} ({disabledPct}%)
            </div>
            <span style={{ padding: "4px 8px", borderRadius: 999, background: "#E8F5E9", color: "#2E7D32", fontSize: 11, fontWeight: 800, lineHeight: 1 }}>
              진행중
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#e9ecef", overflow: "hidden" }}>
            <div
              style={{
                width: `${disabledPct}%`, height: "100%", borderRadius: 999,
                background: disabledPct < 50 ? "#3A8049" : disabledPct < 80 ? "#FF9800" : "#ff2d55",
                transition: "width 300ms ease",
              }}
            />
          </div>
        </div>
      )}

      {/* 🔹 AR 오버레이 lazy + Suspense */}
      <Suspense fallback={null}>
        <SimpleAROverlay
          isActive={isARActive}
          markerData={selectedMarkerData}
          onClose={() => {
            setIsARActive(false);
            setSelectedMarkerData(null);
            mobileLog("AR 오버레이 종료");
          }}
        />
      </Suspense>

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes arButtonPulse {
          0% { box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
          50% { box-shadow: 0 4px 25px rgba(102,126,234,0.4); }
          100% { box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        }
      `}</style>
    </div>
  );
};

export default Map3D;
