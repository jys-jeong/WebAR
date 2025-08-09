// components/SimpleAROverlay.jsx
import React, { useEffect, useRef } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import useCompass from "./useCompass";
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

export default function SimpleAROverlay({ isActive, onClose, markerData }) {
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

  const angleDelta = (a, b) => {
    let d = Math.abs(a - b);
    return d > 180 ? 360 - d : d;
  };

  const isInCameraView = (ghostBearing, cameraBearing, fov = 60) =>
    angleDelta(ghostBearing, cameraBearing) <= fov / 2;

  const getProcessedGhost = (ghost) => {
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
          currentDistance: distance,        // ✅ 실시간 거리
          ghostBearing,
          cameraBearing,
          deltaToCamera: angleDelta(ghostBearing, cameraBearing),
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
        currentDistance: distance,          // ✅ 실시간 거리
        ghostBearing,
        cameraBearing,
        deltaToCamera: angleDelta(ghostBearing, cameraBearing),
        reason: "표시됨",
      };
    }

    return ghost;
  };

  // 기본 세팅
  useEffect(() => {
    if (!isActive) return;
    if (location) resetGame(location);
    else resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // 마커 기준 반경 1m 내 GPS 유령 배치
  useEffect(() => {
    if (!isActive || !markerData?.coords) return;

    const [markerLng, markerLat] = markerData.coords;
    const latRad = (markerLat * Math.PI) / 180;
    const mPerDegLat = 111320;
    const mPerDegLng = Math.cos(latRad) * 111320;

    const makeOffset1m = () => {
      const u = Math.random();
      const r = Math.sqrt(u) * 1.0;
      const theta = Math.random() * 2 * Math.PI;
      const dx = r * Math.cos(theta);
      const dy = r * Math.sin(theta);
      const lng = markerLng + dx / mPerDegLng;
      const lat = markerLat + dy / mPerDegLat;
      return { lat, lng };
    };

    setGhosts((prev) => {
      const hasGps = prev.some((g) => g.type === "gps-fixed");
      if (hasGps) {
        return prev.map((g) => {
          if (g.type !== "gps-fixed") return g;
          const p = makeOffset1m();
          return { ...g, gpsLat: p.lat, gpsLon: p.lng, maxVisibleDistance: g.maxVisibleDistance || 100 };
        });
      } else {
        const p = makeOffset1m();
        return [
          ...prev,
          { type: "gps-fixed", gpsLat: p.lat, gpsLon: p.lng, maxVisibleDistance: 100, size: 120 },
        ];
      }
    });
  }, [isActive, markerData, setGhosts]);

  // camera
  useEffect(() => {
    if (!isActive) return;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
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
            if (!next[index] || next[index].type !== "always-visible") return prev;

            const pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
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
                Math.random() < 0.2 ? Math.max(80, Math.min(250, next[index].size + (Math.random() - 0.5) * 30)) : next[index].size,
              rotation: Math.random() < 0.15 ? (next[index].rotation + Math.random() * 60) % 360 : next[index].rotation,
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

  const processedGhosts = ghosts.map((g) => getProcessedGhost(g));
  const fx = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 9999 }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {/* 👻 실제 렌더 */}
      {processedGhosts.map((pg, i) => {
        if (!pg.pos || pg.pos.x < 0) return null;
        return <Ghost key={`ghost-${i}`} gh={pg} idx={i} onClick={() => catchGhost(i)} />;
      })}

      <ScorePanel left={ghosts.length} score={score} total={totalCaught} />

      {/* ⬅️ 작은 패널: 내 정보 */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 20,
          background: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "10px 12px",
          borderRadius: "8px",
          fontSize: "11px",
          zIndex: 50,
          minWidth: 160,
          maxWidth: 200,
        }}
      >
        <div style={{ color: "#4CAF50", fontWeight: 800, marginBottom: 6 }}>🧍 내 정보</div>
        {location && (
          <div style={{ marginBottom: 4 }}>
            📍 {fx(location.latitude, 6)}, {fx(location.longitude, 6)}
          </div>
        )}
        <div>🧭 Heading: {fx(compass?.heading, 0)}°</div>
        <div>α(Yaw): {fx(orientation?.alpha, 0)}°</div>
        <div>β(Pitch): {fx(orientation?.beta, 0)}°</div>
        <div>γ(Roll): {fx(orientation?.gamma, 0)}°</div>
      </div>

      {/* ➡️ 작은 패널: 유령 정보 (스크롤) */}
      <div
        style={{
          position: "absolute",
          top: 100,
          right: 20,
          maxHeight: "60vh",
          overflowY: "auto",
          background: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "10px 12px",
          borderRadius: "8px",
          fontSize: "11px",
          zIndex: 50,
          minWidth: 160,
          maxWidth: 200,
        }}
      >
        <div style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 6 }}>👻 유령</div>
        {processedGhosts.map((pg, i) => {
          const g = ghosts[i];
          const visible = !!pg.pos && pg.pos.x >= 0;
          return (
            <div key={`info-${i}`} style={{ padding: "8px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontWeight: 800 }}>#{i + 1} • {g.type}</div>
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: visible ? "rgba(76,175,80,0.18)" : "rgba(255,152,0,0.18)",
                    color: visible ? "#4CAF50" : "#FF9800",
                    fontWeight: 800,
                  }}
                >
                  {visible ? "보임" : "숨김"}
                </span>
              </div>

              {/* GPS 유령: 실시간 거리 강조 */}
              {g.type === "gps-fixed" && (
                <>
                  <div>📍 {fx(g.gpsLat, 6)}, {fx(g.gpsLon, 6)}</div>
                  <div style={{ fontWeight: 800 }}>📏 거리: {fx(pg.currentDistance, 1)} m</div> {/* ✅ 실시간 */}
                  <div>🧭 방위: {fx(pg.ghostBearing, 0)}°</div>
                  <div>Δ: {fx(pg.deltaToCamera, 0)}°</div>
                </>
              )}

              {/* 회전 유령: 현재/목표 각도 요약 */}
              {g.type === "orientation-fixed" && (
                <>
                  <div>목표 α/β: {fx(g.targetAlpha, 0)}° / {fx(g.targetBeta, 0)}°</div>
                  <div>현재 α/β: {fx(orientation?.alpha, 0)}° / {fx(orientation?.beta, 0)}°</div>
                </>
              )}

              {/* 항상 보임: 화면 좌표만 간단히 */}
              {g.type === "always-visible" && (
                <>
                  <div>화면: {fx(pg.pos?.x, 0)}%, {fx(pg.pos?.y, 0)}%</div>
                  <div>크기: {Math.round(pg.size || 0)}</div>
                </>
              )}
            </div>
          );
        })}
        {processedGhosts.length === 0 && <div>유령이 없습니다.</div>}
      </div>

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
    </div>
  );
}
