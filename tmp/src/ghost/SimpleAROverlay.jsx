// components/SimpleAROverlay.jsx
import React, { useEffect, useRef, useState } from "react"; // ⭐ useState 추가
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import useCompass from "./useCompass";
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

// 도착/조준 기준
const ARRIVE_RADIUS_M = 1.2;
const AIM_TOLERANCE_DEG = 6;
const CAMERA_FOV_DEG = 60;

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

  // ⭐ 클릭 이펙트 상태
  const [fxList, setFxList] = useState([]);

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
    if (
      ghost.type === "gps-fixed" &&
      location &&
      compass &&
      Number.isFinite(compass.heading)
    ) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      if (distance > ARRIVE_RADIUS_M) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          reason: `도착 필요 (${(distance - ARRIVE_RADIUS_M).toFixed(1)}m 남음)`,
        };
      }

      const ghostBearing = calculateBearing(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );
      const cameraBearing = compass.heading;
      const delta = angleDelta(ghostBearing, cameraBearing);

      if (delta > CAMERA_FOV_DEG / 2) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          ghostBearing,
          cameraBearing,
          deltaToCamera: delta,
          reason: "시야각 밖",
        };
      }

      if (delta > AIM_TOLERANCE_DEG) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          ghostBearing,
          cameraBearing,
          deltaToCamera: delta,
          reason: `미조준 (Δ ${delta.toFixed(0)}°)`,
        };
      }

      // 도착+조준 → 중앙 표시
      const screenX = 50;
      const screenY = 50;
      const sizeScaleRaw = 50 / Math.max(distance, 0.5);
      const sizeScale = Math.max(0.9, Math.min(1.3, sizeScaleRaw));

      return {
        ...ghost,
        pos: { x: screenX, y: screenY },
        size: (ghost.size || 120) * sizeScale,
        opacity: 1,
        currentDistance: distance,
        ghostBearing,
        cameraBearing,
        deltaToCamera: delta,
        reason: "도착+조준 성공",
      };
    }

    // always-visible 등
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
          return {
            ...g,
            gpsLat: p.lat,
            gpsLon: p.lng,
            maxVisibleDistance: g.maxVisibleDistance || 100,
          };
        });
      } else {
        const p = makeOffset1m();
        return [
          ...prev,
          {
            type: "gps-fixed",
            gpsLat: p.lat,
            gpsLon: p.lng,
            maxVisibleDistance: 100,
            size: 120,
          },
        ];
      }
    });
  }, [isActive, markerData, setGhosts]);

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

  const processedGhosts = ghosts.map((g) => getProcessedGhost(g));
  const fx = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");

  // ⭐ 유령 클릭 핸들러: 퇴치 + 이펙트
  const handleGhostClick = (idx, pg) => {
    catchGhost(idx);
    if (navigator.vibrate) try { navigator.vibrate(30); } catch {}
    if (pg?.pos) {
      const id = Math.random().toString(36).slice(2);
      setFxList((list) => [...list, { id, x: pg.pos.x, y: pg.pos.y }]);
      setTimeout(() => {
        setFxList((list) => list.filter((f) => f.id !== id));
      }, 550); // 애니메이션 길이와 맞춤
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 9999 }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {/* 👻 실제 렌더 */}
      {processedGhosts.map((pg, i) => {
        if (!pg?.pos || pg.pos.x < 0) return null;
        return <Ghost key={`ghost-${i}`} gh={pg} idx={i} onClick={() => handleGhostClick(i, pg)} />;
      })}

      {/* ⭐ 퇴치 이펙트 */}
      {fxList.map((f) => (
        <div
          key={f.id}
          style={{
            position: "absolute",
            left: `${f.x}%`,
            top: `${f.y}%`,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 70,
          }}
        >
          <div className="fx-ring" />
          <div className="fx-flash" />
        </div>
      ))}

      {/* ⭐ 점수 패널은 클릭 방해하지 않도록 */}
      <div style={{ pointerEvents: "none", zIndex: 40 }}>
        <ScorePanel left={ghosts.length} score={score} total={totalCaught} />
      </div>

      {/* ⬅️ 내 정보 패널 (작고 클릭 패스-스루) */}
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
          pointerEvents: "none", // ⭐ 패널 뒤 유령 클릭 가능
        }}
      >
        <div style={{ color: "#4CAF50", fontWeight: 800, marginBottom: 6 }}>🧍 내 정보</div>
        {location && <div style={{ marginBottom: 4 }}>📍 {fx(location.latitude, 6)}, {fx(location.longitude, 6)}</div>}
        <div>🧭 Heading: {fx(compass?.heading, 0)}°</div>
        <div>α(Yaw): {fx(orientation?.alpha, 0)}°</div>
        <div>β(Pitch): {fx(orientation?.beta, 0)}°</div>
        <div>γ(Roll): {fx(orientation?.gamma, 0)}°</div>
      </div>

      {/* ➡️ 유령 정보 패널 (작고 클릭 패스-스루) */}
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
          pointerEvents: "none", // ⭐ 패널 뒤 유령 클릭 가능
        }}
      >
        <div style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 6 }}>👻 유령</div>
        {processedGhosts.map((pg, i) => {
          const g = ghosts[i];
          const visible = !!pg?.pos && pg.pos.x >= 0;
          return (
            <div
              key={`info-${i}`}
              style={{
                padding: "8px 8px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.06)",
                marginBottom: 6,
              }}
            >
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

              {g.type === "gps-fixed" && (
                <>
                  <div>📍 {fx(g.gpsLat, 6)}, {fx(g.gpsLon, 6)}</div>
                  <div style={{ fontWeight: 800 }}>📏 거리: {fx(pg.currentDistance, 1)} m</div>
                  <div>🧭 방위: {fx(pg.ghostBearing, 0)}°</div>
                  <div>Δ: {fx(pg.deltaToCamera, 0)}°</div>
                </>
              )}

              {g.type === "orientation-fixed" && (
                <>
                  <div>목표 α/β: {fx(g.targetAlpha, 0)}° / {fx(g.targetBeta, 0)}°</div>
                  <div>현재 α/β: {fx(orientation?.alpha, 0)}° / {fx(orientation?.beta, 0)}°</div>
                </>
              )}

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

      {/* 닫기 (버튼은 눌려야 하므로 auto) */}
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
          zIndex: 80,
          pointerEvents: "auto", // ⭐
        }}
      >
        ×
      </button>

      {/* ⭐ 이펙트용 스타일 */}
      <style jsx>{`
        @keyframes fx-pop {
          0%   { transform: scale(0.3); opacity: 0.9; }
          60%  { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes fx-flash {
          0% { opacity: 0.9; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
        .fx-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 3px solid #ffd700;
          animation: fx-pop 550ms ease-out forwards;
          box-shadow: 0 0 12px rgba(255,215,0,0.8);
        }
        .fx-flash {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 24px;
          height: 24px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: rgba(255,255,255,0.9);
          animation: fx-flash 220ms ease-out forwards;
        }
      `}</style>
    </div>
  );
}
