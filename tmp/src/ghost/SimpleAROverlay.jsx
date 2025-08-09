// components/SimpleAROverlay.jsx
import React, { useEffect, useRef } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import useCompass from "./useCompass";
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);

  const { orientation, supported } = useDeviceOrientation();
  const { location } = useGeoLocation();
  const { compass } = useCompass();

  const {
    ghosts,
    setGhosts,
    score,
    totalCaught,
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

  // Haversine
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Bearing
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
  };

  const isInCameraView = (ghostBearing, cameraBearing, fov = 60) => {
    const halfFov = fov / 2;
    let angleDiff = Math.abs(ghostBearing - cameraBearing);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    return angleDiff <= halfFov;
  };

  const getProcessedGhost = (ghost, index) => {
    if (!supported) return ghost;

    // orientation-fixed
    if (ghost.type === "orientation-fixed") {
      const alphaDiff = Math.min(
        Math.abs(orientation.alpha - ghost.targetAlpha),
        360 - Math.abs(orientation.alpha - ghost.targetAlpha)
      );
      const betaDiff = Math.abs(orientation.beta - ghost.targetBeta);
      const inView = alphaDiff <= ghost.tolerance && betaDiff <= ghost.tolerance;
      if (!inView) return { ...ghost, pos: { x: -100, y: -100 } };
      return ghost;
    }

    // gps-fixed
    if (ghost.type === "gps-fixed" && location && compass) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      const maxDistance = ghost.maxVisibleDistance || 100;
      if (distance > maxDistance) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          reason: "거리 초과",
        };
      }

      const ghostBearing = calculateBearing(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );
      const cameraBearing = compass.heading;
      const inView = isInCameraView(ghostBearing, cameraBearing, 60);

      if (!inView) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          ghostBearing,
          cameraBearing,
          reason: "시야각 밖",
        };
      }

      let angleDiff = ghostBearing - cameraBearing;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const screenX = 50 + (angleDiff / 60) * 80;
      const screenY = 50;
      const sizeScale = Math.max(0.5, 50 / Math.max(distance, 1));

      return {
        ...ghost,
        pos: { x: Math.max(10, Math.min(90, screenX)), y: screenY },
        size: (ghost.size || 120) * sizeScale,
        opacity: Math.max(0.7, 1 - distance / maxDistance),
        currentDistance: distance,
        ghostBearing,
        cameraBearing,
        reason: "표시됨",
      };
    }

    // always-visible
    return ghost;
  };

  // reset on open
  useEffect(() => {
    if (!isActive) return;
    if (location) resetGame(location);
    else resetGame();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // camera
  useEffect(() => {
    if (!isActive) return;
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then((s) => {
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => alert("카메라 권한이 필요합니다"));
    return () => videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
  }, [isActive]);

  // move patterns (always-visible only)
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;

    const timers = ghosts
      .map((gh, index) => {
        if (gh.type === "orientation-fixed" || gh.type === "gps-fixed") return null;

        return setInterval(() => {
          setGhosts((prev) => {
            const next = [...prev];
            if (
              !next[index] ||
              next[index].type === "orientation-fixed" ||
              next[index].type === "gps-fixed"
            )
              return prev;

            const pattern =
              movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
            let { x, y } = next[index].pos;

            switch (pattern) {
              case "random-jump":
                x = Math.random() * 80 + 10;
                y = Math.random() * 80 + 10;
                break;
              case "smooth-slide":
                x = Math.max(10, Math.min(90, x + (Math.random() - 0.5) * 25));
                y = Math.max(10, Math.min(90, y + (Math.random() - 0.5) * 25));
                break;
              default:
                break;
            }

            next[index] = {
              ...next[index],
              pos: { x, y },
              size:
                Math.random() < 0.2
                  ? Math.max(80, Math.min(250, next[index].size + (Math.random() - 0.5) * 30))
                  : next[index].size,
              rotation:
                Math.random() < 0.15
                  ? (next[index].rotation + Math.random() * 60) % 360
                  : next[index].rotation,
            };

            return next;
          });
        }, gh.speed);
      })
      .filter(Boolean);

    return () => {
      timers.forEach(clearInterval);
    };
  }, [isActive, ghosts.length, movementPatterns, setGhosts]);

  if (!isActive) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "#000",
        zIndex: 9999,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Ghosts (GPS 포함) */}
      {ghosts.map((gh, i) => {
        const processedGhost = getProcessedGhost(gh, i);
        if (processedGhost.pos.x < 0) return null;
        return (
          <Ghost key={`ghost-${i}`} gh={processedGhost} idx={i} onClick={() => catchGhost(i)} />
        );
      })}

      <ScorePanel left={ghosts.length} score={score} total={totalCaught} />

      {/* AR Info */}
      {location && compass && (
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 20,
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "11px",
            zIndex: 50,
            minWidth: "250px",
          }}
        >
          <div style={{ color: "#4CAF50", fontWeight: "bold", marginBottom: "8px" }}>
            🌍 AR 카메라 정보
          </div>
          <div>📍 내 위치: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</div>
          <div>🧭 카메라 방향: {compass.heading.toFixed(0)}°</div>
          <div>🎯 시야각: 60° (좌우 30°씩)</div>

          <hr style={{ margin: "8px 0", border: "1px solid #555" }} />

          {/* orientation-fixed info */}
          {ghosts
            .filter((g) => g.type === "orientation-fixed")
            .map((gh, i) => {
              const processed = getProcessedGhost(gh, i);
              const isVisible = processed.pos && processed.pos.x > 0;

              const alphaDiff = Math.min(
                Math.abs(orientation.alpha - gh.targetAlpha),
                360 - Math.abs(orientation.alpha - gh.targetAlpha)
              );
              const betaDiff = Math.abs(orientation.beta - gh.targetBeta);

              return (
                <div key={`orientation-${i}`} style={{ marginBottom: "12px" }}>
                  <div style={{ color: "#FF6B6B", fontWeight: "bold" }}>🎯 회전감지 유령</div>
                  <div>📐 목표 α각도: {gh.targetAlpha.toFixed(0)}°</div>
                  <div>📐 목표 β각도: {gh.targetBeta.toFixed(0)}°</div>
                  <div>⚖️ 허용 오차: ±{gh.tolerance}°</div>
                  <div>📱 현재 α각도: {orientation.alpha.toFixed(0)}°</div>
                  <div>📱 현재 β각도: {orientation.beta.toFixed(0)}°</div>
                  <div>📏 α 차이: {alphaDiff.toFixed(0)}°</div>
                  <div>📏 β 차이: {betaDiff.toFixed(0)}°</div>
                  <div style={{ color: isVisible ? "#4CAF50" : "#FF9800", fontWeight: "bold" }}>
                    📺 상태: {isVisible ? "👁️ 보임" : "❌ 각도 불일치"}
                  </div>
                </div>
              );
            })}

          {/* gps-fixed info */}
          {ghosts
            .filter((g) => g.type === "gps-fixed")
            .map((gh, i) => {
              const processed = getProcessedGhost(gh, i);
              return (
                <div key={`gps-${i}`} style={{ marginTop: "8px" }}>
                  <div style={{ color: "#FFD700", fontWeight: "bold" }}>👻 특정 위치 유령</div>
                  <div>📍 유령 위치: {gh.gpsLat}, {gh.gpsLon}</div>
                  <div>📏 거리: {processed.currentDistance?.toFixed(1)}m</div>
                  <div>🧭 유령 방향: {processed.ghostBearing?.toFixed(0)}°</div>
                  <div
                    style={{
                      color: processed.reason === "표시됨" ? "#4CAF50" : "#FF9800",
                    }}
                  >
                    📺 상태: {processed.reason}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* 닫기 */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: "50%",
          fontSize: 28,
          color: "#fff",
          background: "#FF4444",
          border: "none",
          cursor: "pointer",
          zIndex: 60,
        }}
      >
        ×
      </button>

      {/* 완료 메시지 */}
      {ghosts.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.9)",
            color: "white",
            padding: "30px",
            borderRadius: "20px",
            textAlign: "center",
            zIndex: 100,
            border: "3px solid #FFD700",
          }}
        >
          <h2 style={{ margin: "0 0 15px 0", color: "#FFD700" }}>🎉 축하합니다! 🎉</h2>
          <p style={{ margin: "0", fontSize: "18px" }}>모든 유령을 잡았습니다!</p>
        </div>
      )}

      <style jsx>{`
        @keyframes ghostCatch {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
          25% { transform: translate(-50%, -50%) scale(1.3) rotate(90deg); }
          50% { transform: translate(-50%, -50%) scale(1.1) rotate(180deg); }
          75% { transform: translate(-50%, -50%) scale(1.2) rotate(270deg); }
          100% { transform: translate(-50%, -50%) scale(0) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
