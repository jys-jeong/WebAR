// components/SimpleAROverlay.jsx
import React, { useEffect, useRef, useState } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import useCompass from "./useCompass";
import Ghost from "./Ghost";

// 도착/조준 기준
const ARRIVE_RADIUS_M = 1.2;
const AIM_TOLERANCE_DEG = 6;
const CAMERA_FOV_DEG = 60;

/**
 * props:
 * - isActive: 오버레이 on/off
 * - onClose: 닫기 핸들러
 * - markerData: { coords: [lng, lat] }
 * - onDefeatedDelta?: (inc: number) => void  // 🔥 잡을 때마다 +1 알림(합산용)
 * - onAllGhostsCleared?: () => void          // 전부 퇴치 시 1회 알림(옵션)
 */
export default function SimpleAROverlay({
  isActive,
  onClose,
  markerData,
  onDefeatedDelta,
  onAllGhostsCleared,
}) {
  const videoRef = useRef(null);

  const { orientation, supported } = useDeviceOrientation();
  const { location } = useGeoLocation();
  const { compass } = useCompass();

  const {
    ghosts,
    setGhosts,
    // score,           // <- 사용 안 함
    // totalCaught,     // <- Map3D 합산 방식으로 변경하므로 콜백 전송 불필요
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

  // 클릭 이펙트(링/플래시) + +100p 텍스트 + 오디오 컨텍스트(햅틱 대체)
  const [fxList, setFxList] = useState([]);
  const [pointsFx, setPointsFx] = useState([]);
  const audioCtxRef = useRef(null);

  // 햅틱: vibrate → WebAudio fallback
  const haptic = (ms = 40) => {
    let ok = false;
    try {
      if ("vibrate" in navigator) ok = navigator.vibrate(ms) || false;
    } catch {}
    if (ok) return;

    try {
      const AudioCtx = window.AudioContext || (window).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { try { osc.stop(); } catch {} }, Math.min(120, ms + 60));
    } catch {}
  };

  // --- geo utils ---
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

    // gps-fixed: 도착(≤1.2m) + 시야각/조준 각도
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

      // 도착+조준 성공 → 중앙 표시
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

    return ghost;
  };

  // 초기화
  useEffect(() => {
    if (!isActive) return;
    if (location) resetGame(location);
    else resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // 마커 주변 1m 배치
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
        return [...prev, { type: "gps-fixed", gpsLat: p.lat, gpsLon: p.lng, maxVisibleDistance: 100, size: 120 }];
      }
    });
  }, [isActive, markerData, setGhosts]);

  // 카메라
  useEffect(() => {
    if (!isActive) return;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((s) => { if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => alert("카메라 권한이 필요합니다"));
    return () => videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
  }, [isActive]);

  // 움직임 (always-visible만)
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;
    const timers = ghosts
      .map((gh, index) => {
        if (gh.type === "orientation-fixed" || gh.type === "gps-fixed") return null;
        return setInterval(() => {
          setGhosts((prev) => {
            const next = [...prev];
            if (!next[index] || next[index].type !== "always-visible") return prev;
            const patterns = movementPatterns;
            const pattern = patterns[Math.floor(Math.random() * patterns.length)];
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
              size: Math.random() < 0.2 ? Math.max(80, Math.min(250, next[index].size + (Math.random() - 0.5) * 30)) : next[index].size,
              rotation: Math.random() < 0.15 ? (next[index].rotation + Math.random() * 60) % 360 : next[index].rotation,
            };
            return next;
          });
        }, gh.speed);
      })
      .filter(Boolean);
    return () => { timers.forEach(clearInterval); };
  }, [isActive, ghosts.length, movementPatterns, setGhosts]);

  // ✅ 전부 퇴치되었을 때 1회 알림(옵션)
  const clearedRef = useRef(false);
  useEffect(() => {
    if (!isActive) { clearedRef.current = false; return; }
    if (ghosts.length === 0 && !clearedRef.current) {
      clearedRef.current = true;
      onAllGhostsCleared?.();
    }
    if (ghosts.length > 0) clearedRef.current = false;
  }, [ghosts.length, isActive, onAllGhostsCleared]);

  if (!isActive) return null;

  const processedGhosts = ghosts.map((g) => getProcessedGhost(g));
  const fxNum = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");

  // 유령 클릭: 퇴치 + 햅틱/이펙트 + +100p 텍스트(시각 피드백)
  const handleGhostClick = (idx, pg) => {
    catchGhost(idx);       // 내부 상태 업데이트
    onDefeatedDelta?.(1);  // 🔥 Map3D는 이 값만 누적 합산
    haptic(50);

    if (pg?.pos) {
      // 링/플래시
      const id = Math.random().toString(36).slice(2);
      setFxList((list) => [...list, { id, x: pg.pos.x, y: pg.pos.y }]);
      setTimeout(() => setFxList((list) => list.filter((f) => f.id !== id)), 550);

      // +100p 떠오르기(시각적 피드백)
      const pid = Math.random().toString(36).slice(2);
      setPointsFx((list) => [...list, { id: pid, x: pg.pos.x, y: pg.pos.y }]);
      setTimeout(() => setPointsFx((list) => list.filter((p) => p.id !== pid)), 900);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 9999 }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {/* 유령 레이어(패널보다 위) */}
      <div style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: "auto" }}>
        {processedGhosts.map((pg, i) => {
          if (!pg?.pos || pg.pos.x < 0) return null;
          return <Ghost key={`ghost-${i}`} gh={pg} idx={i} onClick={() => handleGhostClick(i, pg)} />;
        })}
      </div>

      {/* 퇴치 이펙트 */}
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

      {/* +100p 점수 이펙트(시각적 피드백만) */}
      {pointsFx.map((p) => (
        <div
          key={p.id}
          className="score-fx"
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 75,
          }}
        >
          +100p
        </div>
      ))}

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
          zIndex: 20,
          minWidth: 160,
          maxWidth: 200,
          pointerEvents: "none",
        }}
      >
        <div style={{ color: "#4CAF50", fontWeight: 800, marginBottom: 6 }}>🧍 내 정보</div>
        {location && <div style={{ marginBottom: 4 }}>📍 {fxNum(location.latitude, 6)}, {fxNum(location.longitude, 6)}</div>}
        <div>🧭 Heading: {fxNum(compass?.heading, 0)}°</div>
        <div>α(Yaw): {fxNum(orientation?.alpha, 0)}°</div>
        <div>β(Pitch): {fxNum(orientation?.beta, 0)}°</div>
        <div>γ(Roll): {fxNum(orientation?.gamma, 0)}°</div>
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
          zIndex: 30,
          minWidth: 160,
          maxWidth: 200,
          pointerEvents: "none",
        }}
      >
        <div style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 6 }}>👻 유령</div>
        {processedGhosts.map((pg, i) => {
          const g = ghosts[i];
          const visible = !!pg?.pos && pg.pos.x >= 0;
          return (
            <div key={`info-${i}`} style={{ padding: "8px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontWeight: 800 }}>#{i + 1} • {g.type}</div>
                <span style={{ padding: "1px 6px", borderRadius: 999, background: visible ? "rgba(76,175,80,0.18)" : "rgba(255,152,0,0.18)", color: visible ? "#4CAF50" : "#FF9800", fontWeight: 800 }}>
                  {visible ? "보임" : "숨김"}
                </span>
              </div>

              {g.type === "gps-fixed" && (
                <>
                  <div>📍 {fxNum(g.gpsLat, 6)}, {fxNum(g.gpsLon, 6)}</div>
                  <div style={{ fontWeight: 800 }}>📏 거리: {fxNum(pg.currentDistance, 1)} m</div>
                  <div>🧭 방위: {fxNum(pg.ghostBearing, 0)}°</div>
                  <div>Δ: {fxNum(pg.deltaToCamera, 0)}°</div>
                </>
              )}

              {g.type === "orientation-fixed" && (
                <>
                  <div>목표 α/β: {fxNum(g.targetAlpha, 0)}° / {fxNum(g.targetBeta, 0)}°</div>
                  <div>현재 α/β: {fxNum(orientation?.alpha, 0)}° / {fxNum(orientation?.beta, 0)}°</div>
                </>
              )}

              {g.type === "always-visible"&& (
                <>
                  <div>화면: {fxNum(pg.pos?.x, 0)}%, {fxNum(pg.pos?.y, 0)}%</div>
                  <div>크기: {Math.round(pg.size || 0)}</div>
                </>
              )}
            </div>
          );
        })}
        {processedGhosts.length === 0 && <div>유령이 없습니다.</div>}
      </div>

      {/* 닫기 버튼(최상위) */}
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
          zIndex: 90,
          pointerEvents: "auto",
        }}
      >
        ×
      </button>

      {/* 이펙트 스타일 */}
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
        @keyframes score-rise {
          0%   { transform: translate(-50%, -50%) translateY(0);   opacity: 0; }
          10%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translate(-50%, -50%) translateY(-40px); opacity: 0; }
        }
        .score-fx {
          font-weight: 900;
          font-size: 20px;
          color: #ffd700;
          text-shadow: 0 0 8px rgba(255,215,0,0.9), 0 0 16px rgba(255,215,0,0.6);
          animation: score-rise 900ms ease-out forwards;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  );
}
