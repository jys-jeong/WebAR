import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot } from "react-dom/client";
import { PinMarker } from "./PinMarker";
import { DirectionsControl } from "./DirectionsControl";
import SimpleAROverlay from "./ghost/SimpleAROverlay";

// 상수 정의
export const CONFIG = {
  targetLng: 127.1465,
  targetLat: 35.8477,
  markerImageUrl: "/image.jpg",
  mapboxToken:
    "pk.eyJ1IjoiamVvbmd5ZXNlb25nIiwiYSI6ImNtZHJldDNkODBmMW4yaXNhOGE1eWg4ODcifQ.LNsrvvxhCIJ6Lvwc9c0tVg",
};

// const EXTRA_MARKERS = [
//   { lng: 126.81135176573412, lat: 35.20591968576515, title: "카페존", description: "아늑한 카페가 모인 공간" },
//   { lng: 126.81261528847895, lat: 35.20444510122409, title: "공원입구", description: "시민들의 휴식 공간" },
//   { lng: 126.81245924453228, lat: 35.20420911728499, title: "운동시설", description: "건강한 운동을 위한 시설" },
//   { lng: 126.81113524567193, lat: 35.20587354193161, title: "전망포인트", description: "주변 경치를 감상할 수 있는 곳" },
//   { lng: 126.81186114441181, lat: 35.2060250871764, title: "휴게소", description: "편안한 휴식을 위한 벤치" },
//   { lng: 126.81236661283437, lat: 35.20608358739791, title: "문화공간", description: "지역 문화를 체험하는 공간" },
//   { lng: 126.8121031129651, lat: 35.20542587191241, title: "산책로", description: "아름다운 산책을 위한 길" },
//   { lng: 126.81128999013566, lat: 35.204653382328154, title: "놀이터", description: "어린이를 위한 놀이 공간" },
//   { lng: 126.81171287340676, lat: 35.20501171992144, title: "피크닉존", description: "가족 나들이 최적 장소" },
//   { lng: 126.81124313750962, lat: 35.20520425881318, title: "포토스팟", description: "인스타 감성 사진 촬영지" }
// ];
// 기존 EXTRA_MARKERS는 주석 처리/수정하지 말고…

const MARKER_CENTER = { lng: 126.82287685, lat: 35.18376162 };

// 기준 좌표 중심으로 10개 마커 랜덤 배치 (약 100~200m 반경)
export const EXTRA_MARKERS = [
  {
    lng: MARKER_CENTER.lng + 0.0012,
    lat: MARKER_CENTER.lat + 0.001,
    title: "커피마을",
    description: "향긋한 커피가 있는 곳",
  },
  {
    lng: MARKER_CENTER.lng - 0.0011,
    lat: MARKER_CENTER.lat - 0.0007,
    title: "헬스존",
    description: "건강을 위한 헬스장",
  },
  {
    lng: MARKER_CENTER.lng + 0.0008,
    lat: MARKER_CENTER.lat - 0.0012,
    title: "피크닉장",
    description: "야외 피크닉 명소",
  },
  {
    lng: MARKER_CENTER.lng - 0.0009,
    lat: MARKER_CENTER.lat + 0.0005,
    title: "놀이터",
    description: "아이들이 뛰노는 놀이터",
  },
  {
    lng: MARKER_CENTER.lng + 0.0015,
    lat: MARKER_CENTER.lat + 0.0006,
    title: "전망대",
    description: "넓은 경치를 볼 수 있는 전망대",
  },
  {
    lng: MARKER_CENTER.lng - 0.0013,
    lat: MARKER_CENTER.lat + 0.0014,
    title: "사진스팟",
    description: "인생샷 명소",
  },
  {
    lng: MARKER_CENTER.lng + 0.0006,
    lat: MARKER_CENTER.lat - 0.0008,
    title: "문화의 거리",
    description: "지역 문화 예술 공간",
  },
  {
    lng: MARKER_CENTER.lng - 0.0017,
    lat: MARKER_CENTER.lat - 0.0004,
    title: "쉼터",
    description: "잔디와 벤치가 있는 쉼터",
  },
  {
    lng: MARKER_CENTER.lng + 0.0013,
    lat: MARKER_CENTER.lat - 0.0005,
    title: "맛집거리",
    description: "다양한 음식점이 모인 거리",
  },
  {
    lng: MARKER_CENTER.lng - 0.0004,
    lat: MARKER_CENTER.lat + 0.0017,
    title: "산책길",
    description: "산책과 운동 겸하기 좋은 길",
  },
];

mapboxgl.accessToken = CONFIG.mapboxToken;
const coordKey = (coord) => `${coord[0].toFixed(8)},${coord[1].toFixed(8)}`;

// Haversine 공식으로 두 좌표 간 거리 계산 (미터 단위)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 미터 단위 거리
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
  // State
  const [destinationPoint, setDestinationPoint] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [nearbyMarkers, setNearbyMarkers] = useState([]);
  const [showARButton, setShowARButton] = useState(false);
  const [closestMarker, setClosestMarker] = useState(null);
  const [closestDistance, setClosestDistance] = useState(null);
  const [disabledMarkerTitles, setDisabledMarkerTitles] = useState([]);
  // AR 관련 state
  const [isARActive, setIsARActive] = useState(false);
  const [selectedMarkerData, setSelectedMarkerData] = useState(null);

  // 모바일 디버깅용 state
  const [debugInfo, setDebugInfo] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const disabledTitlesRef = useRef([]);

  const [isWalkMode, setIsWalkMode] = useState(false);
  const isWalkModeRef = useRef(false);
  const routeReqRef = useRef(0);
  // 총/비활성화 개수 & 퍼센트
  const totalMarkerCount = EXTRA_MARKERS.length;
  const disabledCount = React.useMemo(() => {
    const set = new Set(disabledMarkerTitles);
    return EXTRA_MARKERS.reduce(
      (acc, m) => acc + (set.has(m.title) ? 1 : 0),
      0
    );
  }, [disabledMarkerTitles]);
  const disabledPct = totalMarkerCount
    ? Math.round((disabledCount / totalMarkerCount) * 100)
    : 0;
  const gaugeAngle = (disabledCount / (totalMarkerCount || 1)) * 360;

  useEffect(() => {
    isWalkModeRef.current = isWalkMode;
    updateDOMMarkers(); // 모드 바뀌면 마커 스타일/인터랙션 갱신
  }, [isWalkMode]);

  useEffect(() => {
    disabledTitlesRef.current = disabledMarkerTitles;
    updateDOMMarkers(); // 비활성 목록 바뀌면 마커 스타일 갱신
  }, [disabledMarkerTitles]);
  // 모바일용 로그 함수
  const mobileLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      time: timestamp,
      message: String(message),
      type: type,
    };

    setDebugInfo((prev) => [logEntry, ...prev.slice(0, 9)]); // 최근 10개만 유지
    console.log(`[${timestamp}] ${message}`);
  };
  function getClosestMarkerAndDistance(userLocation, markers) {
    if (!userLocation || markers.length === 0) {
      return { nearest: null, distance: null };
    }
    let minDist = Infinity;
    let nearest = null;
    markers.forEach((m) => {
      const d = calculateDistance(
        userLocation[1],
        userLocation[0],
        m.lat,
        m.lng
      );
      if (d < minDist) {
        minDist = d;
        nearest = m;
      }
    });
    return { nearest, distance: nearest ? Math.round(minDist) : null };
  }
  useEffect(() => {
    if (!userLocation) {
      setClosestMarker(null);
      setClosestDistance(null);
      setNearbyMarkers([]);
      setShowARButton(false);
      return;
    }

    // 1) 비활성화된 마커는 제외
    const activeMarkers = EXTRA_MARKERS.filter(
      (m) => !disabledMarkerTitles.includes(m.title)
    );
    // 가장 가까운 마커/거리 계산
    const { nearest, distance } = getClosestMarkerAndDistance(
      userLocation,
      activeMarkers
    );
    const inRange = isWalkMode && nearest && distance <= 100;
    setShowARButton(inRange);

    setClosestMarker(inRange ? nearest : null);
    setClosestDistance(inRange ? distance : null);
    setShowARButton(!!inRange);
    setNearbyMarkers(inRange ? [nearest] : []);

    mobileLog(
      inRange
        ? `가장 가까운 활성 마커: ${nearest.title} (${distance}m)`
        : `100m 내 활성 마커 없음`,
      "info"
    );
  }, [userLocation, disabledMarkerTitles, isWalkMode]);
  // 위치 상태 체크 함수 (모바일용)
  const checkLocationStatus = () => {
    mobileLog("=== 위치 정보 상태 체크 ===", "info");
    mobileLog(
      `userLocation: ${
        userLocation
          ? `[${userLocation[0].toFixed(6)}, ${userLocation[1].toFixed(6)}]`
          : "null"
      }`,
      "info"
    );
    mobileLog(`isLocationTracking: ${isLocationTracking}`, "info");
    mobileLog(
      `locationAccuracy: ${
        locationAccuracy ? Math.round(locationAccuracy) + "m" : "null"
      }`,
      "info"
    );
    mobileLog(`navigator.geolocation 지원: ${!!navigator.geolocation}`, "info");

    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        mobileLog(`위치 권한 상태: ${result.state}`, "info");
      });
    }
  };
  // 사용자 위치로 지도 센터링 (한번만)
  const centerMapToUserLocation = (userCoords, zoomLevel = 16) => {
    if (map.current && !hasCenteredOnUser.current) {
      map.current.easeTo({
        center: userCoords,
        zoom: zoomLevel,
        duration: 2000,
      });
      hasCenteredOnUser.current = true;
      mobileLog(
        `지도가 사용자 위치로 센터링됨: [${userCoords[0].toFixed(
          6
        )}, ${userCoords[1].toFixed(6)}]`,
        "success"
      );
    }
  };

  // 실시간 위치 추적 시작 (모바일 로그 추가)
  const startLocationTracking = () => {
    mobileLog("위치 추적 시작 시도...", "info");

    if (!navigator.geolocation) {
      mobileLog("브라우저가 위치 서비스를 지원하지 않습니다", "error");
      return;
    }

    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    setIsLocationTracking(true);

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude, accuracy } = position.coords;
        const userCoords = [longitude, latitude];

        mobileLog(
          `✅ 위치 업데이트 성공: [${longitude.toFixed(6)}, ${latitude.toFixed(
            6
          )}] 정확도: ${Math.round(accuracy)}m`,
          "success"
        );

        setUserLocation(userCoords);
        setLocationAccuracy(accuracy);
        setLastUpdateTime(new Date().toLocaleTimeString());

        if (map.current && map.current.isStyleLoaded()) {
          centerMapToUserLocation(userCoords);
        }
      },
      (error) => {
        let errorMessage = "위치 서비스 오류";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "❌ 위치 접근 권한 거부됨";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "❌ 위치 정보 사용 불가";
            break;
          case error.TIMEOUT:
            errorMessage = "❌ 위치 요청 시간 초과";
            break;
        }
        mobileLog(`${errorMessage}: ${error.message}`, "error");
        setIsLocationTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  };

  // 실시간 위치 추적 중지
  const stopLocationTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsLocationTracking(false);
    mobileLog("위치 추적 중지됨", "warning");
  };

  // GeoJSON 생성 함수
  const createGeojson = (excludeDestination = null) => {
    const baseFeatures = [
      {
        type: "Feature",
        properties: {
          id: "main",
          title: "전북대학교",
          description: "산책 프로젝트 출발지",
        },
        geometry: {
          type: "Point",
          coordinates: [CONFIG.targetLng, CONFIG.targetLat],
        },
      },
      ...EXTRA_MARKERS.map((marker, index) => ({
        type: "Feature",
        properties: {
          id: `spot_${index}`,
          title: marker.title,
          description: marker.description,
        },
        geometry: {
          type: "Point",
          coordinates: [marker.lng, marker.lat],
        },
      })),
    ];

    if (excludeDestination) {
      return {
        type: "FeatureCollection",
        features: baseFeatures.filter((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const [destLng, destLat] = excludeDestination;

          return !(
            Math.abs(lng - destLng) < 0.000001 &&
            Math.abs(lat - destLat) < 0.000001
          );
        }),
      };
    }

    return {
      type: "FeatureCollection",
      features: baseFeatures,
    };
  };

  // 소스와 레이어 안전 제거 함수
  const safeRemoveSourceAndLayers = (sourceId) => {
    if (!map.current) return;

    try {
      const layerIds = {
        "walk-route": ["walk-route"],
        markers: ["clusters", "cluster-count"],
      };

      const layersToRemove = layerIds[sourceId] || [];

      layersToRemove.forEach((layerId) => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });

      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    } catch (error) {
      mobileLog(`소스 제거 중 오류 (무시됨): ${error.message}`, "warning");
    }
  };
  const initializeMap = (center) => {
    if (mapContainer.current) {
      mapContainer.current.innerHTML = "";
    }
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: center,
      zoom: 15,
      pitch: 60,
      bearing: -17.6,
      antialias: true,
      preserveDrawingBuffer: true,
      renderWorldCopies: false,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      "bottom-right"
    );

    geolocateControl.current = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
    });

    map.current.addControl(geolocateControl.current, "bottom-right");

    geolocateControl.current.on("geolocate", (e) => {
      const userCoords = [e.coords.longitude, e.coords.latitude];
      setUserLocation(userCoords);
      setLocationAccuracy(e.coords.accuracy);
      setLastUpdateTime(new Date().toLocaleTimeString());

      centerMapToUserLocation(userCoords);
      mobileLog(
        `Geolocate 컨트롤로 위치 획득: [${userCoords[0].toFixed(
          6
        )}, ${userCoords[1].toFixed(6)}]`,
        "success"
      );
    });

    geolocateControl.current.on("error", (e) => {
      mobileLog(`Geolocate 컨트롤 오류: ${e.message}`, "error");
    });

    map.current.on("load", () => {
      try {
        mobileLog("지도 로드 완료, 레이어 설정 시작", "success");
        setupMapLayers();

        setTimeout(() => {
          if (geolocateControl.current) {
            geolocateControl.current.trigger();
          }
          setTimeout(() => {
            startLocationTracking();
          }, 2000);
        }, 1000);
      } catch (error) {
        mobileLog(`지도 로드 후 초기화 오류: ${error.message}`, "error");
      }
    });

    map.current.on("error", (e) => {
      mobileLog(`Mapbox 에러: ${e.message}`, "error");
    });
  };
  // 지도 초기화
  useEffect(() => {
    if (isInitialized.current || map.current) return;
    isInitialized.current = true;

    // 사용자 위치를 먼저 시도
    if (navigator.geolocation) {
      mobileLog("초기 사용자 위치 요청 시작...", "info");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          setUserLocation(userCoords);
          setLocationAccuracy(position.coords.accuracy);
          setLastUpdateTime(new Date().toLocaleTimeString());

          mobileLog(
            `초기 사용자 위치로 지도 초기화: [${userCoords[0].toFixed(
              6
            )}, ${userCoords[1].toFixed(6)}]`,
            "success"
          );
          initializeMap(userCoords);
          hasCenteredOnUser.current = true;
        },
        (error) => {
          mobileLog(
            `초기 위치 가져오기 실패, CONFIG 좌표로 초기화: ${error.message}`,
            "warning"
          );
          initializeMap([CONFIG.targetLng, CONFIG.targetLat]);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    } else {
      mobileLog("위치 서비스 미지원, CONFIG 좌표로 초기화", "warning");
      initializeMap([CONFIG.targetLng, CONFIG.targetLat]);
    }

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      // DOM 마커 정리: marker 제거 + React root 언마운트
      domMarkerMap.current.forEach((rec) => {
        // 새 구조: { marker, root, ... }
        if (rec?.marker) rec.marker.remove();
        // 예전 구조: Marker 인스턴스를 직접 저장했을 때
        else if (rec?.remove) rec.remove();
        // React root 언마운트
        if (rec?.root) rec.root.unmount();
      });
      domMarkerMap.current.clear();

      // (옵션) 이벤트/컨트롤 정리 – map.remove()가 대부분 처리하지만 안전빵으로
      if (map.current) {
        try {
          map.current.off("click", "clusters", handleClusterClick);
          ["move", "zoom", "idle"].forEach((ev) =>
            map.current.off(ev, updateDOMMarkers)
          );
          if (geolocateControl.current) {
            map.current.removeControl(geolocateControl.current);
          }
        } catch (e) {}
        map.current.remove();
        map.current = null;
      }

      isInitialized.current = false;
      mobileLog("지도 컴포넌트 정리 완료", "info");
    };
  }, []);

  // 고정 위치 기반 길찾기 함수
  const getRouteWithFixedLocation = async (fixedStartLocation, end) => {
    if (!map.current || !map.current.isStyleLoaded()) {
      mobileLog("스타일 미로딩: idle 이후 재시도", "warning");
      map.current.once("idle", () =>
        getRouteWithFixedLocation([...fixedStartLocation], [...end])
      );
      return;
    }

    // 🔢 이 호출만의 고유 id
    const myId = ++routeReqRef.current;
    setIsRouting(true);
    mobileLog(`route req #${myId} 시작`, "info");

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${fixedStartLocation[0]},${fixedStartLocation[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&overview=full&access_token=${CONFIG.mapboxToken}`;
      const res = await fetch(url);
      const data = await res.json();
      mobileLog(
        `route req #${myId}: http=${res.status} code=${data?.code}`,
        "info"
      );

      if (res.status !== 200 || data?.code !== "Ok" || !data?.routes?.length) {
        mobileLog(`route req #${myId}: 경로 없음/에러`, "error");
        alert("경로를 찾지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      // 🛑 최신 요청이 아니면 그리지 말고 종료
      if (myId !== routeReqRef.current) {
        mobileLog(`route req #${myId}: stale 응답, 그리기 스킵`, "warning");
        return;
      }
      // 혹시 남아 있을지 모를 이전 라인/소스 완전 정리(안전빵)
      try {
        safeRemoveSourceAndLayers("walk-route");
      } catch {}
      try {
        if (map.current.getLayer("walk-route"))
          map.current.removeLayer("walk-route");
        if (map.current.getSource("walk-route"))
          map.current.removeSource("walk-route");
      } catch {}

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

      // ✅ 최신 응답만 기존 레이어 제거 + 새로 그리기
      safeRemoveSourceAndLayers("walk-route");
      if (map.current.getLayer("walk-route"))
        map.current.removeLayer("walk-route");
      if (map.current.getSource("walk-route"))
        map.current.removeSource("walk-route");

      map.current.addSource("walk-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: filteredRoute },
        },
      });
      map.current.addLayer({
        id: "walk-route",
        type: "line",
        source: "walk-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ff2d55",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });

      const bounds = filteredRoute.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(filteredRoute[0], filteredRoute[0])
      );
      map.current.fitBounds(bounds, { padding: 50 });
    } catch (e) {
      mobileLog(`❌ route req #${myId} 오류: ${e.message}`, "error");
      alert("길찾기 중 오류가 발생했습니다.");
    } finally {
      // 최신/스테일 상관없이 로딩 플래그만 정리
      setIsRouting(false);
    }
  };
  const handleGaugeStop = () => {
    setIsWalkMode(false);
    setShowARButton(false);
    setIsARActive(false);
    clearRoute();
    setClosestMarker(null);
    setNearbyMarkers([]);
  };

  // 길찾기 함수 (현재 위치 고정)
  const getRoute = async (end) => {
    if (!userLocation) {
      mobileLog("❌ getRoute 호출됐지만 userLocation이 null", "error");
      alert("사용자 위치를 찾을 수 없습니다. 위치 서비스를 활성화해주세요.");
      return;
    }

    // getRoute도 현재 위치를 고정해서 사용
    const fixedLocation = [...userLocation];
    mobileLog("getRoute: 현재 위치 고정됨", "info");
    return getRouteWithFixedLocation(fixedLocation, end);
  };

  // ✅ 경로 초기화 (마커 유지)
  const clearRoute = () => {
    safeRemoveSourceAndLayers("walk-route");
    setDestinationPoint(null);
    // ✅ updateClusterData 호출 제거 - 마커들을 유지
    // updateClusterData(null); // 이 줄을 제거하거나 주석 처리
    mobileLog("경로 초기화 완료 (마커 유지)", "info");
  };

  // ✅ 마커 클릭 핸들러 (마커 유지 버전)
  const handlePinMarkerClick = (coords, feature) => {
    clearRoute();
    mobileLog(
      `마커 클릭됨: [${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}]`,
      "info"
    );
    mobileLog(
      `현재 userLocation: ${
        userLocation
          ? `[${userLocation[0].toFixed(6)}, ${userLocation[1].toFixed(6)}]`
          : "null"
      }`,
      "info"
    );

    setDestinationPoint(coords);
    // ✅ updateClusterData 호출 제거 - 마커들을 유지
    // updateClusterData(coords); // 이 줄을 제거하거나 주석 처리

    if (userLocation) {
      // 현재 시점의 위치를 고정해서 경로 계산
      const fixedStartLocation = [...userLocation]; // 깊은 복사로 현재 위치 고정
      mobileLog(
        `위치 정보 고정됨: [${fixedStartLocation[0].toFixed(
          6
        )}, ${fixedStartLocation[1].toFixed(6)}]`,
        "success"
      );
      mobileLog("고정된 위치 기준으로 경로 계산 시작", "success");
      getRouteWithFixedLocation(fixedStartLocation, coords); // 고정 위치로 경로 계산
    } else {
      mobileLog("❌ 사용자 위치 없음 - 강제로 위치 요청 시도", "warning");

      if (navigator.geolocation) {
        mobileLog("위치 정보 재요청 중...", "info");
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userCoords = [
              position.coords.longitude,
              position.coords.latitude,
            ];
            const fixedStartLocation = [...userCoords]; // 획득한 위치 고정
            setUserLocation(userCoords);
            mobileLog(
              `✅ 위치 정보 재획득 및 고정: [${fixedStartLocation[0].toFixed(
                6
              )}, ${fixedStartLocation[1].toFixed(6)}]`,
              "success"
            );

            setTimeout(() => {
              getRouteWithFixedLocation(fixedStartLocation, coords); // 고정 위치로 경로 계산
            }, 100);
          },
          (error) => {
            mobileLog(`❌ 위치 정보 재획득 실패: ${error.message}`, "error");
            alert(
              `위치 서비스 오류: ${error.message}\n\n해결방법:\n1. 브라우저 설정에서 위치 권한 허용\n2. 페이지 새로고침`
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        mobileLog("❌ 브라우저가 위치 서비스를 지원하지 않음", "error");
        alert("이 브라우저는 위치 서비스를 지원하지 않습니다.");
      }
    }
  };
  // AR 버튼 클릭 핸들러
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

  // AR 종료 함수
  const handleCloseAR = () => {
    setIsARActive(false);
    setSelectedMarkerData(null);
    mobileLog("AR 오버레이 종료됨", "info");
  };

  const handleClusterClick = (event) => {
    const features = map.current.queryRenderedFeatures(event.point, {
      layers: ["clusters"],
    });

    if (!features.length) return;

    const { cluster_id: clusterId, point_count: pointCount } =
      features[0].properties;
    const coordinates = features[0].geometry.coordinates.slice();

    mobileLog(`클러스터 클릭됨: ${pointCount}개 마커`, "info");

    map.current
      .getSource("markers")
      .getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;

        const shouldZoom = window.confirm(
          `클러스터에 ${pointCount}개의 마커가 있습니다.\n확대하시겠습니까?`
        );

        if (shouldZoom) {
          map.current.easeTo({
            center: coordinates,
            zoom: zoom,
          });
          mobileLog(`클러스터 확대: zoom ${zoom}`, "info");
        } else {
          alert(
            `클러스터 정보\n마커 개수: ${pointCount}개\n좌표: ${coordinates[0].toFixed(
              4
            )}, ${coordinates[1].toFixed(4)}`
          );
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
        // ✅ 2) 회색 처리 여부와 클릭 가능 여부를 분리해서 계산
        const visuallyDisabled =
          isWalkModeRef.current && disabledTitlesRef.current.includes(title); // 회색 처리 기준 = disabledMarkerTitles
        const interactive = isWalkModeRef.current && !visuallyDisabled;
        newKeys.add(key);

        const existing = domMarkerMap.current.get(key);

        if (!existing) {
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

          domMarkerMap.current.set(key, {
            marker,
            root,
            disabled: visuallyDisabled,
            interactive,
            title,
          });
        } else {
          // 기존 마커도 두 값이 바뀌었을 때만 재렌더
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

      // 제거된 포인트 청소
      Array.from(domMarkerMap.current.keys()).forEach((key) => {
        if (!newKeys.has(key)) {
          const rec = domMarkerMap.current.get(key);
          rec.marker.remove();
          rec.root.unmount();
          domMarkerMap.current.delete(key);
        }
      });
    } catch (error) {
      mobileLog(`DOM 마커 업데이트 오류: ${error.message}`, "error");
    }
  };
  // 안전한 레이어 설정
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
        paint: {
          "text-color": "#fff",
        },
      });

      map.current.on("click", "clusters", handleClusterClick);
      map.current.on("mouseenter", "clusters", () => {
        map.current.getCanvas().style.cursor = "pointer";
      });
      map.current.on("mouseleave", "clusters", () => {
        map.current.getCanvas().style.cursor = "";
      });
      map.current.on("sourcedata", (e) => {
        if (e.sourceId === "markers" && e.isSourceLoaded) {
          updateDOMMarkers();
        }
      });
      const handleSourceData = (e) => {
        if (e.sourceId === "markers" && e.isSourceLoaded) updateDOMMarkers();
      };
      map.current.on("sourcedata", handleSourceData);

      // cleanup 안 (map.current가 있을 때)
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) =>
          layer.type === "symbol" && layer.layout && layer.layout["text-field"]
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
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.6,
          },
        },
        labelLayerId
      );

      updateDOMMarkers();
      ["move", "zoom", "idle"].forEach((event) => {
        map.current.on(event, updateDOMMarkers);
      });

      mobileLog("지도 레이어 설정 완료", "success");
    } catch (error) {
      mobileLog(`레이어 설정 오류: ${error.message}`, "error");
    }
  };

  return (
    <div
      className="map-container"
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
      }}
    >
      <div
        ref={mapContainer}
        className="mapbox-container"
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      {/* 길찾기 컨트롤
      <DirectionsControl
        onClearRoute={clearRoute}
        isRouting={isRouting}
        destinationPoint={destinationPoint}
      /> */}
      {/* 최근접 마커 정보 표시 */}
      {/* {closestMarker && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: "white",
            padding: "8px 12px",
            borderRadius: "5px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 1000,
          }}
        >
          <strong>가장 가까운 장소:</strong> {closestMarker.title} (
          {closestDistance}m)
        </div>
      )} */}

      {/* 모바일 디버깅 패널 토글 버튼
      <button
        onClick={() => setShowDebugPanel(!showDebugPanel)}
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          background: "#FF5722",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "50px",
          height: "50px",
          fontSize: "20px",
          cursor: "pointer",
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          zIndex: 1001,
        }}
      >
        🐛
      </button> */}

      {/* 모바일 디버깅 패널 */}
      {/* {showDebugPanel && (
        <div
          style={{
            position: "absolute",
            top: "70px",
            left: "10px",
            right: "10px",
            background: "rgba(0, 0, 0, 0.95)",
            color: "white",
            padding: "15px",
            borderRadius: "10px",
            fontFamily: "monospace",
            fontSize: "11px",
            maxHeight: "350px",
            overflowY: "auto",
            zIndex: 1000,
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>🐛 디버깅 정보</span>
            <button
              onClick={() => setDebugInfo([])}
              style={{
                background: "#666",
                color: "white",
                border: "none",
                borderRadius: "5px",
                padding: "5px 10px",
                fontSize: "10px",
                cursor: "pointer",
              }}
            >
              로그 지우기
            </button>
          </div>

          {/* 현재 상태 요약 */}
      {/* <div
            style={{
              marginBottom: "15px",
              padding: "10px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "5px",
            }}
          >
            <div>
              <strong>위치상태:</strong> {userLocation ? "✅ 있음" : "❌ 없음"}
            </div>
            <div>
              <strong>추적상태:</strong>{" "}
              {isLocationTracking ? "✅ 활성" : "❌ 비활성"}
            </div>
            <div>
              <strong>정확도:</strong>{" "}
              {locationAccuracy
                ? `±${Math.round(locationAccuracy)}m`
                : "알수없음"}
            </div>
            {userLocation && (
              <div>
                <strong>좌표:</strong> [{userLocation[0].toFixed(6)},{" "}
                {userLocation[1].toFixed(6)}]
              </div>
            )}
            <div>
              <strong>근처마커:</strong> {nearbyMarkers.length}개
            </div>
            <div>
              <strong>AR버튼:</strong> {showARButton ? "✅ 표시" : "❌ 숨김"}
            </div>
          </div> */}

      {/* 로그 목록 */}
      {/* <div style={{ marginBottom: "15px" }}>
            {debugInfo.length === 0 ? (
              <div style={{ textAlign: "center", color: "#999" }}>
                로그가 없습니다
              </div>
            ) : (
              debugInfo.map((log, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "5px",
                    padding: "5px",
                    borderRadius: "3px",
                    background:
                      log.type === "error"
                        ? "rgba(244, 67, 54, 0.2)"
                        : log.type === "success"
                        ? "rgba(76, 175, 80, 0.2)"
                        : log.type === "warning"
                        ? "rgba(255, 152, 0, 0.2)"
                        : "rgba(33, 150, 243, 0.2)",
                    fontSize: "10px",
                    lineHeight: "1.3",
                  }}
                >
                  <span style={{ color: "#ccc" }}>[{log.time}]</span>{" "}
                  {log.message}
                </div>
              ))
            )}
          </div> */}

      {/* 디버깅 버튼들 */}
      {/* <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <button
              onClick={checkLocationStatus}
              style={{
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "5px",
                padding: "8px 12px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              상태확인
            </button>

            <button
              onClick={() => {
                if (navigator.geolocation) {
                  mobileLog("강제 위치 요청 시작...", "info");
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const userCoords = [
                        position.coords.longitude,
                        position.coords.latitude,
                      ];
                      setUserLocation(userCoords);
                      setLocationAccuracy(position.coords.accuracy);
                      setLastUpdateTime(new Date().toLocaleTimeString());
                      mobileLog("✅ 강제 위치 요청 성공!", "success");
                    },
                    (error) => {
                      mobileLog(
                        `❌ 강제 위치 요청 실패: ${error.message}`,
                        "error"
                      );
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                  );
                }
              }}
              style={{
                background: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                padding: "8px 12px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              위치 강제요청
            </button>

            <button
              onClick={
                isLocationTracking
                  ? stopLocationTracking
                  : startLocationTracking
              }
              style={{
                background: isLocationTracking ? "#F44336" : "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "5px",
                padding: "8px 12px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              {isLocationTracking ? "추적중지" : "추적시작"}
            </button>

            <button
              onClick={() => {
                if (userLocation) {
                  navigator.clipboard.writeText(
                    `${userLocation[0]}, ${userLocation[1]}`
                  );
                  mobileLog("좌표가 클립보드에 복사됨", "info");
                } else {
                  mobileLog("복사할 위치 정보가 없음", "warning");
                }
              }}
              style={{
                background: "#9C27B0",
                color: "white",
                border: "none",
                borderRadius: "5px",
                padding: "8px 12px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              좌표복사
            </button>
          </div>
        </div>
      )} }}

      {/* 실시간 위치 정보 패널 - 위치가 있을 때만 표시 */}
      {/* {userLocation && (
        <div
          style={{
            position: "absolute",
            bottom: "120px",
            left: "20px",
            right: "20px",
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "15px",
            borderRadius: "10px",
            fontFamily: "monospace",
            fontSize: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            zIndex: 1000,
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>📍</span>
            실시간 위치 정보
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isLocationTracking ? "#4CAF50" : "#F44336",
                marginLeft: "auto",
                animation: isLocationTracking ? "pulse 2s infinite" : "none",
              }}
            />
          </div>

          <div style={{ lineHeight: "1.6" }}>
            <div>
              <strong>경도:</strong> {userLocation[0].toFixed(8)}
            </div>
            <div>
              <strong>위도:</strong> {userLocation[1].toFixed(8)}
            </div>
            {locationAccuracy && (
              <div>
                <strong>정확도:</strong> ±{Math.round(locationAccuracy)}m
              </div>
            )}
            {lastUpdateTime && (
              <div>
                <strong>업데이트:</strong> {lastUpdateTime}
              </div>
            )}
            <div
              style={{
                marginTop: "8px",
                padding: "5px 8px",
                borderRadius: "5px",
                backgroundColor:
                  nearbyMarkers.length > 0
                    ? "rgba(76, 175, 80, 0.2)"
                    : "rgba(244, 67, 54, 0.2)",
                border: `1px solid ${
                  nearbyMarkers.length > 0 ? "#4CAF50" : "#F44336"
                }`,
              }}
            >
              <strong>100m 내 마커:</strong> {nearbyMarkers.length}개
              {nearbyMarkers.length > 0 && (
                <div style={{ fontSize: "10px", marginTop: "2px" }}>
                  🎯 AR 기능 활성화됨
                </div>
              )}
            </div>
          </div>
        </div>
      )} */}
      {!isWalkMode && (
        // ✅ 하단 중앙 원형 Start 버튼
        <button
          onClick={() => setIsWalkMode(true)}
          aria-label="산책 시작"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 24, // 필요하면 24 대신 더 올리기/내리기
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
      {/* 내 위치 버튼 */}
      {userLocation && (
        <button
          onClick={() => {
            map.current.easeTo({
              center: userLocation,
              zoom: 16,
              duration: 1000,
            });
            mobileLog("내 위치로 지도 이동", "info");
          }}
          style={{
            position: "absolute",
            bottom: "70px",
            right: "20px",
            background: "#007cbf",
            color: "white",
            border: "none",
            borderRadius: "50%",
            padding: "15px",
            fontSize: "18px",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            zIndex: 1000,
          }}
        >
          📍
        </button>
      )}

      {/* 조건부 AR 버튼 */}
      {showARButton && (
        <button
          onClick={handleARButtonClick}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "50px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.3s ease",
            minWidth: "120px",
            justifyContent: "center",
            animation: "arButtonPulse 2s infinite",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.transform = "translateY(-2px)";
            el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.transform = "translateY(0)";
            el.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
          }}
        >
          <span style={{ fontSize: "16px" }}>📷</span>
          <span>AR 카메라</span>
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
          {/* 상단 행: 종료 / 수치 / 진행중 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr auto",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {/* 빨간 종료 버튼 */}
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

            {/* 비율 텍스트(가운데) */}
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

            {/* 우측 ‘진행중’ 배지 */}
            <span
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                background: "#E8F5E9", // 연한 초록 배경
                color: "#2E7D32", // 진한 초록 글자
                fontSize: 11,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              진행중
            </span>
          </div>

          {/* 얇은 바 게이지 */}
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
      {/* SimpleAROverlay */}
      <SimpleAROverlay
        isActive={isARActive}
        markerData={selectedMarkerData}
        onClose={handleCloseAR}
      />

      {/* CSS 애니메이션 */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes arButtonPulse {
          0% {
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          }
          50% {
            box-shadow: 0 4px 25px rgba(102, 126, 234, 0.4);
          }
          100% {
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          }
        }
      `}</style>
    </div>
  );
};

export default Map3D;
