import { useEffect, useMemo, useState } from "react";

export const DirectionsControl = ({
  onClearRoute,
  isRouting,
  destinationPoint,
  userLocation,
  markers = [],
  onARButtonClick,
}) => {
  const [excludedMarkers, setExcludedMarkers] = useState([]);

  // 거리 계산 함수 (Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // 가장 가까운 마커 계산 (제외 대상 포함)
  const { closestMarker, minDistance } = useMemo(() => {
    let closest = null;
    let minDist = Infinity;
    if (userLocation && markers.length > 0) {
      markers.forEach((marker) => {
        if (excludedMarkers.includes(marker.title)) return;

        const distance = calculateDistance(
          userLocation[1],
          userLocation[0],
          marker.lat,
          marker.lng
        );

        if (distance < minDist) {
          minDist = distance;
          closest = marker;
        }
      });
    }
    return { closestMarker: closest, minDistance: minDist };
  }, [userLocation, markers, excludedMarkers]);

  // AR 버튼 표시 조건
  const arThreshold = 100;
  const showARButton =
    closestMarker &&
    minDistance <= arThreshold &&
    destinationPoint &&
    (destinationPoint[0] !== closestMarker.lng ||
      destinationPoint[1] !== closestMarker.lat);

  // AR 버튼 눌렀을 때 해당 마커 제외 + 외부 알림
  const handleAR = () => {
    if (closestMarker && !excludedMarkers.includes(closestMarker.title)) {
      setExcludedMarkers((prev) => [...prev, closestMarker.title]);
    }
    if (onARButtonClick) onARButtonClick();
  };

  return (
    <div
      className="directions-control"
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        background: "white",
        padding: 10,
        borderRadius: 8,
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        zIndex: 1000,
      }}
    >
      <h4 style={{ margin: "0 0 10px 0", fontSize: 14 }}>전북대 → 목적지</h4>

      <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
        {destinationPoint ? (
          <>
            목적지: {destinationPoint[0].toFixed(4)},{" "}
            {destinationPoint[1].toFixed(4)}
          </>
        ) : (
          "마커를 클릭하여 목적지를 선택하세요"
        )}
      </div>

      <div style={{ marginBottom: 8, fontSize: 11, color: "#999" }}>
        출발지: 전북대학교 (고정) | 도착지는 클러스터링 제외
      </div>

      {closestMarker && (
        <div style={{ marginBottom: 8, fontSize: 12, color: "#333" }}>
          🔍 가장 가까운 마커: {closestMarker.title} ({minDistance.toFixed(1)}m)
        </div>
      )}
      {excludedMarkers.length > 0 && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "#999",
            background: "#f9f9f9",
            padding: "6px",
            borderRadius: 4,
          }}
        >
          <div style={{ marginBottom: 4, fontWeight: "bold", fontSize: 12 }}>
            ❌ 제외된 마커
          </div>
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {excludedMarkers.map((title, idx) => (
              <li key={idx}>{title}</li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={onClearRoute}
          style={{
            background: "#666",
            color: "white",
            border: "none",
            padding: "6px 12px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          경로 초기화
        </button>

        {isRouting && (
          <span style={{ fontSize: 12, color: "#3A8049" }}>길찾기 중...</span>
        )}

        {showARButton && (
          <button
            onClick={handleAR}
            style={{
              fontSize: 12,
              color: "#FF5722",
              background: "none",
              border: "1px solid #FF5722",
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            🎯 AR 가능: {closestMarker.title}
          </button>
        )}
      </div>
    </div>
  );
};
