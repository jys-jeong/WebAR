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
  mapboxToken: "pk.eyJ1IjoiamVvbmd5ZXNlb25nIiwiYSI6ImNtZHJldDNkODBmMW4yaXNhOGE1eWg4ODcifQ.LNsrvvxhCIJ6Lvwc9c0tVg",
};

const EXTRA_MARKERS = [
  { lng: 127.14764312652059, lat: 35.84418165482111, title: "산책로 입구", description: "아름다운 산책로의 시작점" },
  { lng: 127.14613156528183, lat: 35.84964804127036, title: "연못 쉼터", description: "연못가의 평화로운 휴식공간" },
  { lng: 127.14214296827205, lat: 35.845700639080235, title: "벚꽃길", description: "봄철 벚꽃이 만개하는 길" },
  { lng: 127.14984840092337, lat: 35.85156432205935, title: "전망대", description: "주변을 한눈에 볼 수 있는 곳" },
  { lng: 127.14247370527909, lat: 35.84926823721113, title: "운동기구", description: "건강한 운동을 위한 공간" },
  { lng: 127.14692305866805, lat: 35.852323070669286, title: "피크닉존", description: "가족 피크닉 장소" },
  { lng: 127.14215263696799, lat: 35.846070049809214, title: "독서공간", description: "조용한 독서 공간" },
  { lng: 127.14206556949755, lat: 35.84662512473487, title: "산책로 종점", description: "산책로의 마지막 지점" },
];

mapboxgl.accessToken = CONFIG.mapboxToken;
const coordKey = (coord) => `${coord[0].toFixed(8)},${coord[1].toFixed(8)}`;

const Map3D = () => {
  // Refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const domMarkerMap = useRef(new Map());
  const geolocateControl = useRef(null);
  const watchId = useRef(null); // 실시간 위치 추적 ID

  // State
  const [destinationPoint, setDestinationPoint] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeMarkers, setRouteMarkers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationTracking, setIsLocationTracking] = useState(false); // 실시간 추적 상태
  const [locationAccuracy, setLocationAccuracy] = useState(null); // 위치 정확도
  const [lastUpdateTime, setLastUpdateTime] = useState(null); // 마지막 업데이트 시간

  // AR 관련 state
  const [isARActive, setIsARActive] = useState(false);
  const [selectedMarkerData, setSelectedMarkerData] = useState(null);

  const startPoint = [CONFIG.targetLng, CONFIG.targetLat];

  // 실시간 위치 추적 시작
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      console.warn('이 브라우저는 위치 서비스를 지원하지 않습니다.');
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
        
        setUserLocation(userCoords);
        setLocationAccuracy(accuracy);
        setLastUpdateTime(new Date().toLocaleTimeString());

        // 지도가 로드된 후에만 중심 이동 (처음에만)
        if (map.current && map.current.isStyleLoaded() && !watchId.current) {
          map.current.easeTo({
            center: userCoords,
            zoom: 16,
            duration: 1000
          });
        }

        console.log("실시간 위치 업데이트:", userCoords, "정확도:", accuracy, "m");
      },
      (error) => {
        console.warn('실시간 위치 추적 오류:', error.message);
        setIsLocationTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000
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
  };

  // GeoJSON 생성 함수
  const createGeojson = (excludeDestination = null) => {
    const baseFeatures = [
      {
        type: "Feature",
        properties: { 
          id: "main",
          title: "전북대학교",
          description: "산책 프로젝트 출발지"
        },
        geometry: { 
          type: "Point", 
          coordinates: [CONFIG.targetLng, CONFIG.targetLat] 
        },
      },
      ...EXTRA_MARKERS.map((marker, index) => ({
        type: "Feature",
        properties: { 
          id: `spot_${index}`,
          title: marker.title,
          description: marker.description
        },
        geometry: { 
          type: "Point", 
          coordinates: [marker.lng, marker.lat] 
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

  // 지도 초기화
  useEffect(() => {
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

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      "bottom-right"
    );

    // GeolocateControl 추가 및 참조 저장
    geolocateControl.current = new mapboxgl.GeolocateControl({
      positionOptions: { 
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0
      },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
    });

    map.current.addControl(geolocateControl.current, "bottom-right");

    // 위치 찾기 성공 시 이벤트 리스너
    geolocateControl.current.on('geolocate', (e) => {
      const userCoords = [e.coords.longitude, e.coords.latitude];
      setUserLocation(userCoords);
      setLocationAccuracy(e.coords.accuracy);
      setLastUpdateTime(new Date().toLocaleTimeString());
      
      // 지도 중심을 내 위치로 이동
      map.current.easeTo({
        center: userCoords,
        zoom: 16,
        duration: 2000
      });

      console.log("내 위치:", userCoords);
    });

    // 위치 찾기 오류 시 이벤트 리스너
    geolocateControl.current.on('error', (e) => {
      console.warn('위치를 찾을 수 없습니다:', e);
    });

    map.current.on("load", () => {
      const startMarker = addRouteMarker(startPoint, "start");
      setRouteMarkers([startMarker]);

      // 지도 로드 완료 후 자동으로 내 위치 찾기 시작
      setTimeout(() => {
        geolocateControl.current.trigger();
        // 실시간 위치 추적도 시작
        startLocationTracking();
      }, 1000);
    });

    return () => {
      // 컴포넌트 언마운트 시 실시간 추적 중지
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      
      domMarkerMap.current.forEach((marker) => marker.remove());
      domMarkerMap.current.clear();
      
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 내 위치 직접 가져오기 (추가적인 방법)
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return;
    }

    const getCurrentLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = [position.coords.longitude, position.coords.latitude];
          setUserLocation(userCoords);
          setLocationAccuracy(position.coords.accuracy);
          setLastUpdateTime(new Date().toLocaleTimeString());
          
          if (map.current && map.current.isStyleLoaded()) {
            map.current.easeTo({
              center: userCoords,
              zoom: 16,
              duration: 2000
            });
          }
        },
        (error) => {
          console.warn('위치 접근이 거부되었거나 오류가 발생했습니다:', error.message);
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    };

    getCurrentLocation();
  }, []);

  // 클러스터 데이터 업데이트
  const updateClusterData = (excludeDestination = null) => {
    if (!map.current?.getSource("markers")) return;
    const newGeojson = createGeojson(excludeDestination);
    map.current.getSource("markers").setData(newGeojson);
  };

  // 길찾기 함수
  const getRoute = async (start, end) => {
    setIsRouting(true);

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${CONFIG.mapboxToken}&overview=full`
      );

      const data = await response.json();

      if (data.routes?.length > 0) {
        const routeData = data.routes[0];
        const routeCoords = routeData.geometry.coordinates;

        const enhancedRoute = [start, ...routeCoords, end];
        const filteredRoute = enhancedRoute.filter((coord, index) => {
          if (index === 0) return true;

          const prevCoord = enhancedRoute[index - 1];
          const distance = Math.sqrt(
            Math.pow(coord[0] - prevCoord[0], 2) +
            Math.pow(coord[1] - prevCoord[1], 2)
          );

          return distance > 0.00001;
        });

        if (map.current.getSource("route")) {
          map.current.removeLayer("route");
          map.current.removeSource("route");
        }

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

        alert(
          `경로 안내\n거리: ${distance}km\n예상 시간: ${duration}분\n경로 포인트: ${filteredRoute.length}개`
        );
      } else {
        alert("경로를 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("길찾기 오류:", error);
      alert("길찾기 중 오류가 발생했습니다.");
    } finally {
      setIsRouting(false);
    }
  };

  // 경로 초기화
  const clearRoute = () => {
    if (map.current.getSource("route")) {
      map.current.removeLayer("route");
      map.current.removeSource("route");
    }

    routeMarkers.slice(1).forEach((marker) => marker.remove());
    setRouteMarkers((prev) => prev.slice(0, 1));
    setDestinationPoint(null);
    updateClusterData(null);
  };

  // 경로 마커 추가
  const addRouteMarker = (coords, type) => {
    const element = document.createElement("div");
    
    Object.assign(element.style, {
      width: "25px",
      height: "25px",
      borderRadius: "50%",
      border: "3px solid white",
      backgroundColor: type === "start" ? "#4CAF50" : "#F44336",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      zIndex: "1000",
    });

    element.innerHTML = `
      <div style="
        color: white; 
        font-size: 10px; 
        font-weight: bold; 
        text-align: center; 
        line-height: 19px;
      ">
        ${type === "start" ? "S" : "E"}
      </div>
    `;

    return new mapboxgl.Marker(element)
      .setLngLat(coords)
      .addTo(map.current);
  };

  // 이벤트 핸들러들
  const handleRouteMarkerClick = (coords) => {
    if (routeMarkers.length > 1) {
      routeMarkers.slice(1).forEach((marker) => marker.remove());
    }

    setDestinationPoint(coords);
    const endMarker = addRouteMarker(coords, "end");
    setRouteMarkers((prev) => [prev[0], endMarker]);

    updateClusterData(coords);
    
    const startLocation = userLocation || startPoint;
    getRoute(startLocation, coords);
  };

  const handlePinMarkerClick = (coords, feature) => {
    console.log("개별 마커 클릭됨:", coords);
    handleRouteMarkerClick(coords);
  };

  // AR 버튼 클릭 핸들러
  const handleARButtonClick = () => {
    if (destinationPoint) {
      const markerIndex = EXTRA_MARKERS.findIndex(marker => 
        Math.abs(marker.lng - destinationPoint[0]) < 0.000001 &&
        Math.abs(marker.lat - destinationPoint[1]) < 0.000001
      );

      const markerInfo = EXTRA_MARKERS[markerIndex] || {};

      setSelectedMarkerData({
        coords: destinationPoint,
        title: markerInfo.title || "선택된 지점",
        description: "이 지점의 이미지를 AR로 확인해보세요!",
        imageUrl: CONFIG.markerImageUrl,
        id: `spot_${markerIndex}`
      });
    } else {
      setSelectedMarkerData({
        coords: userLocation || startPoint,
        title: "AR 이미지 뷰어",
        description: "카메라 위에 이미지를 오버레이합니다!",
        imageUrl: CONFIG.markerImageUrl,
        id: "main"
      });
    }
    
    setIsARActive(true);
  };

  // AR 종료 함수
  const handleCloseAR = () => {
    setIsARActive(false);
    setSelectedMarkerData(null);
  };

  const handleClusterClick = (event) => {
    const features = map.current.queryRenderedFeatures(event.point, {
      layers: ["clusters"],
    });

    if (!features.length) return;

    const { cluster_id: clusterId, point_count: pointCount } = features[0].properties;
    const coordinates = features[0].geometry.coordinates.slice();

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
        } else {
          alert(
            `클러스터 정보\n마커 개수: ${pointCount}개\n좌표: ${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}`
          );
        }
      });
  };

  // DOM 마커 업데이트
  const updateDOMMarkers = () => {
    if (!map.current.getSource("markers")) return;
    
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
  };

  // 클러스터 및 3D 빌딩 레이어 설정
  useEffect(() => {
    if (!map.current) return;

    map.current.on("load", () => {
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
    });
  }, []);

  return (
    <div 
      className="map-container"
      style={{ 
        width: "100%", 
        height: "100vh", 
        position: "relative" 
      }}
    >
      <div 
        ref={mapContainer} 
        className="mapbox-container"
        style={{ 
          width: "100%", 
          height: "100%" 
        }} 
      />
      
      {/* 길찾기 컨트롤 */}
      <DirectionsControl
        onClearRoute={clearRoute}
        isRouting={isRouting}
        destinationPoint={destinationPoint}
      />

      {/* 실시간 위치 정보 패널 */}
      {userLocation && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "15px",
            borderRadius: "10px",
            fontFamily: "monospace",
            fontSize: "12px",
            minWidth: "280px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            zIndex: 1000,
            backdropFilter: "blur(5px)",
          }}
        >
          <div style={{ 
            fontSize: "14px", 
            fontWeight: "bold", 
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{ fontSize: "16px" }}>📍</span>
            실시간 위치 정보
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isLocationTracking ? "#4CAF50" : "#F44336",
              marginLeft: "auto",
              animation: isLocationTracking ? "pulse 2s infinite" : "none"
            }} />
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
          </div>

          {/* 실시간 추적 제어 버튼들 */}
          <div style={{ 
            marginTop: "10px", 
            display: "flex", 
            gap: "5px" 
          }}>
            <button
              onClick={isLocationTracking ? stopLocationTracking : startLocationTracking}
              style={{
                background: isLocationTracking ? "#F44336" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                padding: "5px 10px",
                fontSize: "10px",
                cursor: "pointer",
                flex: 1
              }}
            >
              {isLocationTracking ? "추적 중지" : "실시간 추적"}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${userLocation[0]}, ${userLocation[1]}`);
                alert("좌표가 복사되었습니다!");
              }}
              style={{
                background: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "5px",
                padding: "5px 10px",
                fontSize: "10px",
                cursor: "pointer",
              }}
            >
              복사
            </button>
          </div>
        </div>
      )}

      {/* 내 위치 버튼 */}
      {userLocation && (
        <button
          onClick={() => {
            map.current.easeTo({
              center: userLocation,
              zoom: 16,
              duration: 1000
            });
          }}
          style={{
            position: "absolute",
            top: "140px",
            right: "20px",
            background: "#007cbf",
            color: "white",
            border: "none",
            borderRadius: "50px",
            padding: "10px",
            fontSize: "16px",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            zIndex: 1000,
          }}
        >
          📍
        </button>
      )}

      {/* AR 버튼 */}
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
          justifyContent: "center"
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = "translateY(-2px)";
          e.target.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = "translateY(0)";
          e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
        }}
      >
        <span style={{ fontSize: "16px" }}>📷</span>
        <span>AR 카메라</span>
      </button>

      {/* SimpleAROverlay */}
      <SimpleAROverlay
        isActive={isARActive}
        markerData={selectedMarkerData}
        onClose={handleCloseAR}
      />

      {/* CSS 애니메이션 */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Map3D;
