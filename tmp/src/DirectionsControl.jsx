export const DirectionsControl = ({
  onClearRoute,
  isRouting,
  destinationPoint,
  userLocation,
  markers = [],
}) => {
  // 거리 계산 함수 (Haversine)
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

    return R * c;
  };

  // 가장 가까운 마커 계산
  let closestMarker = null;
  let minDistance = Infinity;
  if (userLocation && markers.length > 0) {
    markers.forEach((marker) => {
      const distance = calculateDistance(
        userLocation[1],
        userLocation[0],
        marker.lat,
        marker.lng
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestMarker = marker;
      }
    });
  }

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

      <div>
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
          <span style={{ marginLeft: 10, fontSize: 12, color: "#3A8049" }}>
            길찾기 중...
          </span>
        )}
      </div>
    </div>
  );
};
