// components/ScorePanel.jsx
export default function ScorePanel({ left, score, total, ghosts = [] }) {
  // 유령 유형별 개수 계산
  const gpsGhosts = ghosts.filter(g => g.type === "gps-fixed");
  const orientationGhosts = ghosts.filter(g => g.type === "orientation-fixed");
  const locationDirectionGhosts = ghosts.filter(g => g.type === "location-direction"); // ✅ 추가
  const visibleGhosts = ghosts.filter(g => g.type === "always-visible");

  return (
    <div style={{
      position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.8)", color: "white", padding: "15px 20px",
      borderRadius: "15px", textAlign: "center", zIndex: 50, minWidth: "320px",
      border: "2px solid #4CAF50",
    }}>
      <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "10px", color: "#4CAF50" }}>
        👻 게임 현황
      </div>
      
      <div style={{ fontSize: "14px", marginBottom: "12px" }}>
        🎯 점수: <span style={{ color: "#FFD700", fontWeight: "bold" }}>{score}</span> | 
        총 잡은 수: <span style={{ color: "#FFD700", fontWeight: "bold" }}>{total}</span>
      </div>

      {/* 유령 유형별 현황 */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "11px" }}>
        {/* GPS 유령 */}
        <div style={{
          flex: 1, background: "rgba(33, 150, 243, 0.2)", border: "1px solid #2196F3",
          borderRadius: "8px", padding: "6px 4px", textAlign: "center"
        }}>
          <div style={{ fontSize: "14px", marginBottom: "3px" }}>🌍</div>
          <div style={{ color: "#2196F3", fontWeight: "bold", fontSize: "10px" }}>GPS</div>
          <div style={{ color: gpsGhosts.length > 0 ? "#4CAF50" : "#888" }}>
            {gpsGhosts.length}마리
          </div>
        </div>

        {/* 회전감지 유령 */}
        <div style={{
          flex: 1, background: "rgba(255, 107, 107, 0.2)", border: "1px solid #FF6B6B",
          borderRadius: "8px", padding: "6px 4px", textAlign: "center"
        }}>
          <div style={{ fontSize: "14px", marginBottom: "3px" }}>🎯</div>
          <div style={{ color: "#FF6B6B", fontWeight: "bold", fontSize: "10px" }}>회전</div>
          <div style={{ color: orientationGhosts.length > 0 ? "#4CAF50" : "#888" }}>
            {orientationGhosts.length}마리
          </div>
        </div>

        {/* ✅ 위치+방향 유령 추가 */}
        <div style={{
          flex: 1, background: "rgba(255, 215, 0, 0.2)", border: "1px solid #FFD700",
          borderRadius: "8px", padding: "6px 4px", textAlign: "center"
        }}>
          <div style={{ fontSize: "14px", marginBottom: "3px" }}>🧭</div>
          <div style={{ color: "#FFD700", fontWeight: "bold", fontSize: "10px" }}>위치+방향</div>
          <div style={{ color: locationDirectionGhosts.length > 0 ? "#4CAF50" : "#888" }}>
            {locationDirectionGhosts.length}마리
          </div>
        </div>

        {/* 일반 유령 */}
        <div style={{
          flex: 1, background: "rgba(76, 175, 80, 0.2)", border: "1px solid #4CAF50",
          borderRadius: "8px", padding: "6px 4px", textAlign: "center"
        }}>
          <div style={{ fontSize: "14px", marginBottom: "3px" }}>👻</div>
          <div style={{ color: "#4CAF50", fontWeight: "bold", fontSize: "10px" }}>일반</div>
          <div style={{ color: visibleGhosts.length > 0 ? "#4CAF50" : "#888" }}>
            {visibleGhosts.length}마리
          </div>
        </div>
      </div>

      <div style={{ 
        marginTop: "10px", fontSize: "14px", fontWeight: "bold",
        color: left > 0 ? "#FFD700" : "#4CAF50" 
      }}>
        {left > 0 ? `남은 유령: ${left}마리` : "🎉 모든 유령 처치 완료!"}
      </div>
    </div>
  );
}
