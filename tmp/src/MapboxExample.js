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
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// 반경 내 마커 찾기 함수
const findMarkersWithinRadius = (userLocation, markers, radius = 100) => {
  if (!userLocation) return [];
  const [lng, lat] = userLocation;
  return markers.filter(
    (m) => calculateDistance(lat, lng, m.lat, m.lng) <= radius
  );
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
  const [excludedMarkers, setExcludedMarkers] = useState([]);
  // AR 관련 state
  const [isARActive, setIsARActive] = useState(false);
  const [selectedMarkerData, setSelectedMarkerData] = useState(null);

  // 모바일 디버깅용 state
  const [debugInfo, setDebugInfo] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const startPoint = [CONFIG.targetLng, CONFIG.targetLat];

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
  useEffect(() => {
    if (!userLocation) {
      setNearbyMarkers([]);
      setShowARButton(false);
      return;
    }
    const avail = EXTRA_MARKERS.filter(
      (m) => !excludedMarkers.includes(m.title)
    );
    const inRange = findMarkersWithinRadius(userLocation, avail, 100);
    setNearbyMarkers(inRange);
    setShowARButton(inRange.length > 0);
  }, [userLocation, excludedMarkers]);
  // 반경 내 마커 체크 및 AR 버튼 표시 조건 업데이트
  useEffect(() => {
    if (userLocation) {
      const allMarkers = [...EXTRA_MARKERS];

      const available = allMarkers.filter(
        (m) => !excludedMarkers.includes(m.title)
      );
      const markersInRange = findMarkersWithinRadius(
        userLocation,
        available,
        100
      );
      setNearbyMarkers(markersInRange);
      setShowARButton(markersInRange.length > 0);

      mobileLog(`반경 100m 내 마커: ${markersInRange.length}개`, "info");
    } else {
      setNearbyMarkers([]);
      setShowARButton(false);
    }
  }, [userLocation]);

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
        route: ["route"],
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

  // 지도 초기화
  useEffect(() => {
    if (isInitialized.current || map.current) return;
    isInitialized.current = true;

    const initializeMap = (center) => {
      if (mapContainer.current) {
        mapContainer.current.innerHTML = "";
      }

      mobileLog(
        `지도 초기화 시작: [${center[0].toFixed(6)}, ${center[1].toFixed(6)}]`,
        "info"
      );

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

      domMarkerMap.current.forEach((marker) => marker.remove());
      domMarkerMap.current.clear();

      if (map.current) {
        map.current.remove();
        map.current = null;
      }

      isInitialized.current = false;
      mobileLog("지도 컴포넌트 정리 완료", "info");
    };
  }, []);

  // 클러스터 데이터 업데이트
  const updateClusterData = (excludeDestination = null) => {
    if (!map.current?.getSource("markers")) return;

    try {
      const newGeojson = createGeojson(excludeDestination);
      map.current.getSource("markers").setData(newGeojson);
    } catch (error) {
      mobileLog(`클러스터 데이터 업데이트 오류: ${error.message}`, "error");
    }
  };

  // 고정 위치 기반 길찾기 함수
  const getRouteWithFixedLocation = async (fixedStartLocation, end) => {
    setIsRouting(true);
    mobileLog(
      `🗺️ 고정 위치 기반 길찾기 시작: [${fixedStartLocation[0].toFixed(
        6
      )}, ${fixedStartLocation[1].toFixed(6)}] → [${end[0].toFixed(
        6
      )}, ${end[1].toFixed(6)}]`,
      "info"
    );

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${fixedStartLocation[0]},${fixedStartLocation[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${CONFIG.mapboxToken}&overview=full`
      );

      const data = await response.json();

      if (data.routes?.length > 0) {
        const routeData = data.routes[0];
        const routeCoords = routeData.geometry.coordinates;

        const enhancedRoute = [fixedStartLocation, ...routeCoords, end];
        const filteredRoute = enhancedRoute.filter((coord, index) => {
          if (index === 0) return true;
          const prevCoord = enhancedRoute[index - 1];
          const distance = Math.sqrt(
            Math.pow(coord[0] - prevCoord[0], 2) +
              Math.pow(coord[1] - prevCoord[1], 2)
          );
          return distance > 0.00001;
        });

        safeRemoveSourceAndLayers("route");

        map.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: filteredRoute,
            },
          },
        });

        map.current.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3A8049",
            "line-width": 6,
            "line-opacity": 0.8,
          },
        });

        const bounds = filteredRoute.reduce(
          (bounds, coord) => bounds.extend(coord),
          new mapboxgl.LngLatBounds(filteredRoute[0], filteredRoute[0])
        );

        map.current.fitBounds(bounds, { padding: 50 });

        const distance = (routeData.distance / 1000).toFixed(1);
        const duration = Math.round(routeData.duration / 60);

        const destination = EXTRA_MARKERS.find(
          (marker) =>
            Math.abs(marker.lng - end[0]) < 0.000001 &&
            Math.abs(marker.lat - end[1]) < 0.000001
        );

        // 현재 위치와 고정 위치가 다른 경우 알림에 표시
        const currentLocation = userLocation;
        const locationChanged =
          currentLocation &&
          (Math.abs(currentLocation[0] - fixedStartLocation[0]) > 0.00001 ||
            Math.abs(currentLocation[1] - fixedStartLocation[1]) > 0.00001);
      } else {
        mobileLog("❌ 경로를 찾을 수 없음", "error");
        alert("경로를 찾을 수 없습니다.");
      }
    } catch (error) {
      mobileLog(`❌ 길찾기 오류: ${error.message}`, "error");
      alert("길찾기 중 오류가 발생했습니다.");
    } finally {
      setIsRouting(false);
    }
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
    safeRemoveSourceAndLayers("route");
    setDestinationPoint(null);
    // ✅ updateClusterData 호출 제거 - 마커들을 유지
    // updateClusterData(null); // 이 줄을 제거하거나 주석 처리
    mobileLog("경로 초기화 완료 (마커 유지)", "info");
  };

  // ✅ 마커 클릭 핸들러 (마커 유지 버전)
  const handlePinMarkerClick = (coords, feature) => {
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
    if (!nearbyMarkers.length) return;
    const marker = nearbyMarkers[0]; // closest
    setExcludedMarkers((prev) => [...prev, marker.title]);
    setSelectedMarkerData({
      coords: [marker.lng, marker.lat],
      title: marker.title,
      description: marker.description,
      imageUrl: CONFIG.markerImageUrl,
      id: marker.title,
    });
    setIsARActive(true);
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

  // DOM 마커 업데이트
  const updateDOMMarkers = () => {
    if (!map.current?.getSource("markers")) return;

    try {
      const features = map.current.querySourceFeatures("markers") || [];
      const singlePoints = features.filter((f) => !f.properties.point_count);

      const newKeys = new Set();

      singlePoints.forEach((feature) => {
        const coordArr = feature.geometry.coordinates;
        const key = coordKey(coordArr);
        newKeys.add(key);

        if (!domMarkerMap.current.has(key)) {
          const element = document.createElement("div");

          createRoot(element).render(
            <PinMarker
              imageUrl={CONFIG.markerImageUrl}
              onClick={() => handlePinMarkerClick(coordArr, feature)}
            />
          );

          const marker = new mapboxgl.Marker(element)
            .setLngLat(coordArr)
            .addTo(map.current);

          domMarkerMap.current.set(key, marker);
        }
      });

      Array.from(domMarkerMap.current.keys()).forEach((key) => {
        if (!newKeys.has(key)) {
          domMarkerMap.current.get(key).remove();
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

      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === "symbol" && layer.layout["text-field"]
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
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <DirectionsControl
        onClearRoute={() => {/* clear route logic */}}
        isRouting={isRouting}
        userLocation={userLocation}
        markers={EXTRA_MARKERS.filter(m => !excludedMarkers.includes(m.title))}
        onARButtonClick={handleARButtonClick}
      />
      {showARButton && (
        <button onClick={handleARButtonClick} /* style props */>
          📷 AR 카메라
        </button>
      )}
      <SimpleAROverlay
        isActive={isARActive}
        markerData={selectedMarkerData}
        onClose={() => setIsARActive(false)}
      />
    </div>
  );
};

export default Map3D;
