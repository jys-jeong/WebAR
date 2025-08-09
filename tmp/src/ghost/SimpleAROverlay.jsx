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
 * - onDefeatedDelta?: (inc: number) => void  // 유령 잡을 때마다 +1
 * - onBonusPoints?: (p: number) => void      // 보물상자 포인트
 * - onAllGhostsCleared?: () => void          // 전부 퇴치시 1회 알림(옵션)
 */
export default function SimpleAROverlay({
  isActive,
  onClose,
  markerData,
  onDefeatedDelta,
  onBonusPoints,
  onAllGhostsCleared,
}) {
  const videoRef = useRef(null);

  const { orientation, supported } = useDeviceOrientation();
  const { location } = useGeoLocation();
  const { compass } = useCompass();

  const {
    ghosts,
    setGhosts,
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

  // 클릭 이펙트(링/플래시) + 점수 텍스트 이펙트 + 오디오 컨텍스트(햅틱 대체)
  const [fxList, setFxList] = useState([]);
  const [pointsFx, setPointsFx] = useState([]);
  const audioCtxRef = useRef(null);

  // 보물상자 상태
  const [chestCooling, setChestCooling] = useState(false);
  const [chestClaimed, setChestClaimed] = useState(false);
  const [chestPoints, setChestPoints] = useState(0);

  // 상자 오픈 애니메이션(이미지+포인트 표시 후 자동 제거)
  const [chestFx, setChestFx] = useState(null); // { id, reward }

  // iOS 센서 권한 버튼 노출
  const [needMotionPerm, setNeedMotionPerm] = useState(false);

  // HTTPS 체크(정보용)
  const isSecure = typeof window !== "undefined" && window.isSecureContext;

  // 세션 집계 + 결과 모달
  const [sessionCaught, setSessionCaught] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  const resultTimerRef = useRef(null);
  const resultShownRef = useRef(false);

  const openResult = () => {
    if (resultShownRef.current) return;
    resultShownRef.current = true;
    setResultOpen(true);
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  // 햅틱: vibrate → WebAudio fallback
  const haptic = (ms = 40) => {
    let ok = false;
    try {
      if ("vibrate" in navigator) ok = navigator.vibrate(ms) || false;
    } catch {}
    if (ok) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { try { osc.stop(); } catch {} }, Math.min(120, ms + 60));
    } catch {}
  };

  // --- geo/orientation utils ---
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

  // 화면 회전 각도(0/90/180/270)
  const getScreenAngle = () => {
    try {
      if (window.screen?.orientation?.angle != null) return window.screen.orientation.angle;
      if (typeof window.orientation === "number") return window.orientation;
    } catch {}
    return 0;
  };

  // 나침반 대체 계산: alpha(0~360)로 heading 추정 (시계방향, 화면 각도 보정)
  const computeHeadingFromAlpha = () => {
    const a = orientation?.alpha;
    if (!Number.isFinite(a)) return null;
    let hdg = (360 - a + getScreenAngle()) % 360;
    if (hdg < 0) hdg += 360;
    return hdg;
  };

  // iOS 센서 권한 버튼 노출 조건
  useEffect(() => {
    const need =
      (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") ||
      (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function");
    setNeedMotionPerm(!!need);
  }, []);

  // 오버레이가 켜질 때 자동 권한 요청 "시도"
  useEffect(() => {
    if (!isActive) return;
    (async () => {
      if (
        (typeof DeviceMotionEvent !== "undefined" &&
          typeof DeviceMotionEvent.requestPermission === "function") ||
        (typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function")
      ) {
        try {
          let granted = false;
          if (typeof DeviceMotionEvent?.requestPermission === "function") {
            const r = await DeviceMotionEvent.requestPermission();
            granted = granted || (r === "granted");
          }
          if (typeof DeviceOrientationEvent?.requestPermission === "function") {
            const r2 = await DeviceOrientationEvent.requestPermission();
            granted = granted || (r2 === "granted");
          }
          setNeedMotionPerm(!granted);
          if (granted) haptic(20);
        } catch {
          setNeedMotionPerm(true);
        }
      }
    })();
  }, [isActive]);

  // iOS 권한 요청(버튼)
  const requestMotionPermissions = async () => {
    try {
      let granted = false;
      if (typeof DeviceMotionEvent?.requestPermission === "function") {
        const r = await DeviceMotionEvent.requestPermission();
        granted = granted || (r === "granted");
      }
      if (typeof DeviceOrientationEvent?.requestPermission === "function") {
        const r2 = await DeviceOrientationEvent.requestPermission();
        granted = granted || (r2 === "granted");
      }
      setNeedMotionPerm(!granted);
      if (granted) haptic(30);
    } catch {
      setNeedMotionPerm(true);
    }
  };

  const getProcessedGhost = (ghost) => {
    // orientation-fixed
    if (ghost.type === "orientation-fixed") {
      if (!supported) return { ...ghost, pos: { x: -100, y: -100 }, reason: "센서 미지원/미허용" };
      const alphaDiff = Math.min(
        Math.abs(orientation.alpha - ghost.targetAlpha),
        360 - Math.abs(orientation.alpha - ghost.targetAlpha)
      );
      const betaDiff = Math.abs(orientation.beta - ghost.targetBeta);
      const inView = alphaDiff <= ghost.tolerance && betaDiff <= ghost.tolerance;
      if (!inView) return { ...ghost, pos: { x: -100, y: -100 } };
      return ghost;
    }

    // gps-fixed: ★ 거리와 상관없이 방위/델타 "항상" 계산해서 패널에 표기되게 함
    if (ghost.type === "gps-fixed" && location) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      const fallbackHeading = computeHeadingFromAlpha();
      const cameraBearing = Number.isFinite(compass?.heading)
        ? compass.heading
        : (Number.isFinite(fallbackHeading) ? fallbackHeading : null);

      const ghostBearing = calculateBearing(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      const delta = Number.isFinite(cameraBearing)
        ? angleDelta(ghostBearing, cameraBearing)
        : null;

      // 1) 아직 도착 반경 밖
      if (distance > ARRIVE_RADIUS_M) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          ghostBearing,
          cameraBearing,
          deltaToCamera: delta,
          reason: `도착 필요 (${(distance - ARRIVE_RADIUS_M).toFixed(1)}m 남음)`,
        };
      }

      // 2) 방위 없음
      if (!Number.isFinite(cameraBearing)) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          ghostBearing,
          cameraBearing,
          deltaToCamera: delta,
          reason: "방위(나침반/알파) 없음",
        };
      }

      // 3) 시야각 밖
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

      // 4) 미조준
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

      // 5) 도착+조준 성공 → 중앙 표시
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

  // 세션 리셋 + 20초 결과 타이머
  useEffect(() => {
    if (!isActive) return;

    setSessionCaught(0);
    setChestClaimed(false);
    setChestPoints(0);
    setResultOpen(false);
    resultShownRef.current = false;
    setChestFx(null);

    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(openResult, 20000);

    return () => {
      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }
    };
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

  // 전부 퇴치되었을 때 1회 알림(옵션)
  const clearedRef = useRef(false);
  useEffect(() => {
    if (!isActive) { clearedRef.current = false; return; }
    if (ghosts.length === 0 && !clearedRef.current) {
      clearedRef.current = true;
      onAllGhostsCleared?.();
    }
    if (ghosts.length > 0) clearedRef.current = false;
  }, [ghosts.length, isActive, onAllGhostsCleared]);

  // 모든 유령(=0) + 상자 클릭 완료시 즉시 결과
  useEffect(() => {
    if (!isActive || resultShownRef.current) return;
    const allGhostsCleared = ghosts.length === 0;
    if (allGhostsCleared && chestClaimed) {
      openResult();
    }
  }, [ghosts.length, chestClaimed, isActive]);

  if (!isActive) return null;

  const processedGhosts = ghosts.map((g) => getProcessedGhost(g));

  // 유령 클릭: 퇴치 + 햅틱/이펙트 + +100p 텍스트
  const handleGhostClick = (idx, pg) => {
    catchGhost(idx);
    setSessionCaught((n) => n + 1);
    onDefeatedDelta?.(1);
    haptic(50);

    if (pg?.pos) {
      const id = Math.random().toString(36).slice(2);
      setFxList((list) => [...list, { id, x: pg.pos.x, y: pg.pos.y }]);
      setTimeout(() => setFxList((list) => list.filter((f) => f.id !== id)), 550);

      const pid = Math.random().toString(36).slice(2);
      setPointsFx((list) => [...list, { id: pid, x: pg.pos.x, y: pg.pos.y, text: "+100p" }]);
      setTimeout(() => setPointsFx((list) => list.filter((p) => p.id !== pid)), 900);
    }
  };

  // 보물상자 클릭: 500~3000p 랜덤 보상 + Map3D 콜백(1회만) + 오픈 애니메이션 표시 후 자동 제거
  const handleChestClick = (e) => {
    e.stopPropagation();
    if (chestCooling || chestClaimed) return;

    const reward = Math.floor(Math.random() * (3000 - 500 + 1)) + 500;
    setChestClaimed(true);
    setChestPoints(reward);
    onBonusPoints?.(reward);
    haptic(60);

    // 오픈 이펙트(이미지+포인트) — 하단 중앙 위쪽에 잠깐 표시
    const id = Math.random().toString(36).slice(2);
    setChestFx({ id, reward });
    setTimeout(() => setChestFx(null), 1200); // 애니메이션 종료 후 제거

    // 쿨다운(버튼 회색 효과 유지)
    setChestCooling(true);
    setTimeout(() => setChestCooling(false), 1200);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 9999 }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {/* iOS 센서 권한 버튼 */}
      {needMotionPerm && (
        <button
          onClick={requestMotionPermissions}
          style={{
            position: "absolute",
            top: "calc(18px + env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 120,
            padding: "10px 14px",
            borderRadius: 999,
            border: "none",
            background: "#3A8049",
            color: "#fff",
            fontWeight: 800,
            letterSpacing: 0.2,
            boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
            cursor: "pointer",
          }}
        >센서 허용</button>
      )}

      {/* 유령 레이어 */}
      <div style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: "auto" }}>
        {processedGhosts.map((pg, i) => {
          if (!pg?.pos || pg.pos.x < 0) return null;
          return <Ghost key={`ghost-${i}`} gh={pg} idx={i} onClick={() => handleGhostClick(i, pg)} />;
        })}
      </div>

      {/* 이펙트 */}
      {fxList.map((f) => (
        <div key={f.id} style={{ position: "absolute", left: `${f.x}%`, top: `${f.y}%`, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 70 }}>
          <div className="fx-ring" />
          <div className="fx-flash" />
        </div>
      ))}
      {pointsFx.map((p) => (
        <div key={p.id} className="score-fx" style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 75 }}>
          {p.text || "+100p"}
        </div>
      ))}

      {/* ⬅️ 내 정보 패널 */}
      <div style={{ position: "absolute", top: 100, left: 20, background: "rgba(0,0,0,0.8)", color: "white", padding: "10px 12px", borderRadius: "8px", fontSize: "11px", zIndex: 20, minWidth: 160, maxWidth: 200, pointerEvents: "none" }}>
        <div style={{ color: "#4CAF50", fontWeight: 800, marginBottom: 6 }}>🧍 내 정보</div>
        {!isSecure && <div style={{ color: "#ffb300", marginBottom: 4 }}>⚠ HTTPS 아님</div>}
        {location && <div style={{ marginBottom: 4 }}>📍 {fxNum(location.latitude, 6)}, {fxNum(location.longitude, 6)}</div>}
        <div>🧭 Heading(hook): {fxNum(compass?.heading, 0)}°</div>
        <div>🧭 Heading(alpha→보정): {fxNum(computeHeadingFromAlpha(), 0)}°</div>
        <div>α(Yaw): {fxNum(orientation?.alpha, 0)}°</div>
        <div>β(Pitch): {fxNum(orientation?.beta, 0)}°</div>
        <div>γ(Roll): {fxNum(orientation?.gamma, 0)}°</div>
      </div>

      {/* ➡️ 유령 정보 패널 */}
      <div style={{ position: "absolute", top: 100, right: 20, maxHeight: "60vh", overflowY: "auto", background: "rgba(0,0,0,0.8)", color: "white", padding: "10px 12px", borderRadius: "8px", fontSize: "11px", zIndex: 30, minWidth: 160, maxWidth: 200, pointerEvents: "none" }}>
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
                  <div>🧭 방위(목표): {fxNum(pg.ghostBearing, 0)}°</div>
                  <div>🧭 방위(카메라): {fxNum(pg.cameraBearing, 0)}°</div>
                  <div>Δ: {fxNum(pg.deltaToCamera, 0)}°</div>
                  {pg.reason && <div style={{ opacity: 0.8 }}>• {pg.reason}</div>}
                </>
              )}

              {g.type === "orientation-fixed" && (
                <>
                  <div>목표 α/β: {fxNum(g.targetAlpha, 0)}° / {fxNum(g.targetBeta, 0)}°</div>
                  <div>현재 α/β: {fxNum(orientation?.alpha, 0)}° / {fxNum(orientation?.beta, 0)}°</div>
                </>
              )}
            </div>
          );
        })}
        {processedGhosts.length === 0 && <div>유령이 없습니다.</div>}
      </div>

      {/* ⭐ 보물상자 — 항상 화면에 보임 (하단 중앙) */}
      <button
        onClick={handleChestClick}
        aria-label="Treasure Chest"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "calc(26px + env(safe-area-inset-bottom))",
          transform: "translateX(-50%)",
          width: 72,
          height: 72,
          borderRadius: 16,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: (chestCooling || chestClaimed) ? "default" : "pointer",
          zIndex: 85,
          pointerEvents: "auto",
        }}
        disabled={chestCooling || chestClaimed}
      >
        <img
          src="/box.png"
          alt="treasure box"
          draggable="false"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: (chestCooling || chestClaimed) ? "grayscale(0.5) brightness(0.9)" : "none",
            animation: (chestCooling || chestClaimed) ? "none" : "chest-bounce 1500ms ease-in-out infinite",
            userSelect: "none",
          }}
        />
      </button>

      {/* ✅ 상자 오픈 애니메이션 (boxopen.png + 보상 포인트) */}
      {chestFx && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(110px + env(safe-area-inset-bottom))",
            transform: "translateX(-50%)",
            zIndex: 180,
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          <img
            src="/boxopen.png"
            alt="opened chest"
            className="chest-open-pop"
            draggable="false"
            style={{
              width: 110,
              height: "auto",
              display: "block",
              margin: "0 auto",
              filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.35))",
              userSelect: "none",
            }}
          />
          <div
            className="chest-reward-pop"
            style={{
              fontWeight: 900,
              fontSize: 22,
              color: "#ffd700",
              textShadow: "0 0 10px rgba(255,215,0,0.9), 0 0 18px rgba(255,215,0,0.6)",
              marginTop: 6,
              letterSpacing: 0.5,
            }}
          >
            +{chestFx.reward}p
          </div>
        </div>
      )}

      {/* 결과 모달 */}
      {resultOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              width: "min(320px, 86%)",
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
              padding: "18px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>결과</div>

            <div style={{ marginBottom: 8, fontSize: 14 }}>
              잡은 유령 수: <b>{sessionCaught}</b>
            </div>
            <div style={{ marginBottom: 14, fontSize: 14 }}>
              보물상자 포인트: <b>{chestPoints}</b>p
            </div>

            <button
              onClick={onClose}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 10,
                border: "none",
                fontWeight: 800,
                background: "#3A8049",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              나가기
            </button>
          </div>
        </div>
      )}

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
        @keyframes chest-bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-6px); }
        }

        /* ✅ 상자 오픈 애니메이션 */
        @keyframes chest-open-pop {
          0%   { transform: scale(0.6) translateY(0);   opacity: 0; }
          25%  { transform: scale(1.05) translateY(-6px); opacity: 1; }
          70%  { transform: scale(1.0) translateY(-10px); opacity: 1; }
          100% { transform: scale(0.9) translateY(-16px); opacity: 0; }
        }
        @keyframes chest-reward-rise {
          0%   { transform: translateY(6px); opacity: 0; }
          20%  { opacity: 1; }
          70%  { transform: translateY(-6px); opacity: 1; }
          100% { transform: translateY(-22px); opacity: 0; }
        }
        .chest-open-pop {
          animation: chest-open-pop 1200ms ease-out forwards;
        }
        .chest-reward-pop {
          animation: chest-reward-rise 1200ms ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function fxNum(v, d = 0) {
  return Number.isFinite(v) ? v.toFixed(d) : "—";
}
