// components/SimpleAROverlay.jsx
import React, { useEffect, useRef, useState } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import useCompass from "./useCompass";
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toRad = (d) => (d * Math.PI) / 180;
const wrap360 = (d) => (d % 360 + 360) % 360;
const ema = (prev, next, alpha = 0.15) =>
  prev == null ? next : prev + alpha * (next - prev);

// 거리/방위
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const dφ = toRad(lat2 - lat1), dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const bearingBetween = (lat1, lon1, lat2, lon2) => {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), dλ = toRad(lon2 - lon1);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return wrap360((Math.atan2(y, x) * 180) / Math.PI);
};

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);

  const { orientation, supported } = useDeviceOrientation(); // α(heading 근사), β(pitch)
  const { location } = useGeoLocation();                      // { latitude, longitude }
  const { compass } = useCompass();                           // { heading }

  const {
    ghosts,
    setGhosts,
    score,
    totalCaught,
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

  // ▶︎ 나침반 스무딩 + 보정
  const [smoothHeading, setSmoothHeading] = useState(null); // 0~360° EMA
  const [calib, setCalib] = useState(0);                    // 보정 오프셋(°)

  useEffect(() => {
    if (!isActive) return;
    // compass.heading이 바뀔 때만 EMA 갱신해서 리렌더 최소화
    if (compass?.heading != null) {
      setSmoothHeading((prev) => wrap360(ema(prev, compass.heading, 0.15)));
    }
  }, [isActive, compass?.heading]);

  // 카메라
  useEffect(() => {
    if (!isActive) return;
    let stream;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          return videoRef.current.play?.();
        }
      })
      .catch(() => alert("카메라 권한이 필요합니다."));
    return () => stream?.getTracks?.().forEach((t) => t.stop());
  }, [isActive]);

  // AR 열릴 때 한 번 리셋(위치 있으면 그걸로 초기화)
  useEffect(() => {
    if (!isActive) return;
    resetGame(location || undefined);
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // 시야 판정
  const isInCameraView = (ghostBearing, camBearing, fov = 60) => {
    let diff = Math.abs(ghostBearing - camBearing);
    if (diff > 180) diff = 360 - diff;
    return diff <= fov / 2;
  };

  // 유령 위치/표시 계산
  const getProcessedGhost = (ghost, index) => {
    // 회전 각도 매칭형은 기존 로직 유지
    if (ghost.type === "orientation-fixed" && orientation) {
      const alphaDiff = Math.min(
        Math.abs(orientation.alpha - ghost.targetAlpha),
        360 - Math.abs(orientation.alpha - ghost.targetAlpha)
      );
      const betaDiff = Math.abs(orientation.beta - ghost.targetBeta);
      const inView = alphaDiff <= ghost.tolerance && betaDiff <= ghost.tolerance;
      return inView ? ghost : { ...ghost, pos: { x: -100, y: -100 } };
    }

    // GPS 고정형
    if (ghost.type === "gps-fixed" && location && (smoothHeading != null || compass?.heading != null)) {
      const dist = haversine(location.latitude, location.longitude, ghost.gpsLat, ghost.gpsLon);
      const maxD = ghost.maxVisibleDistance || 100;
      if (dist > maxD) return { ...ghost, pos: { x: -100, y: -100 }, currentDistance: dist, reason: "거리 초과" };

      const tgtBearing = bearingBetween(location.latitude, location.longitude, ghost.gpsLat, ghost.gpsLon);

      // 보정 적용한 카메라 방위
      const cam = wrap360((smoothHeading ?? compass.heading ?? 0) - calib);

      const inView = isInCameraView(tgtBearing, cam, 60);
      if (!inView) return { ...ghost, pos: { x: -100, y: -100 }, currentDistance: dist, ghostBearing: tgtBearing, cameraBearing: cam, reason: "시야각 밖" };

      // 화면 좌표 계산 (X: 방위차 / Y: 피치)
      let angleDiff = tgtBearing - cam;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const screenX = clamp(50 + (angleDiff / 60) * 80, 10, 90); // fov=60 → 80% 폭 매핑
      const pitch = orientation?.beta ?? 0;                       // 기기 상하 각(대략 -90~90)
      const screenY = clamp(50 - (pitch / 30) * 20, 10, 90);      // 피치 30°당 20% 이동

      const sizeScale = Math.max(0.5, 50 / Math.max(dist, 1));
      return {
        ...ghost,
        pos: { x: screenX, y: screenY },
        size: (ghost.size || 120) * sizeScale,
        opacity: Math.max(0.7, 1 - dist / maxD),
        currentDistance: dist,
        ghostBearing: tgtBearing,
        cameraBearing: cam,
        reason: "표시됨",
      };
    }

    // always-visible 등
    return ghost;
  };

  // 움직이는(랜덤) 유령만 기존 타이머 유지
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;
    const timers = ghosts
      .map((gh, idx) => {
        if (gh.type === "orientation-fixed" || gh.type === "gps-fixed") return null;
        return setInterval(() => {
          setGhosts((prev) => {
            const arr = [...prev];
            if (!arr[idx] || arr[idx].type !== "always-visible") return prev;
            const pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
            let { x, y } = arr[idx].pos;
            switch (pattern) {
              case "random-jump":
                x = Math.random() * 80 + 10; y = Math.random() * 80 + 10; break;
              case "smooth-slide":
                x = clamp(x + (Math.random() - 0.5) * 25, 10, 90);
                y = clamp(y + (Math.random() - 0.5) * 25, 10, 90);
                break;
              default:
                break;
            }
            arr[idx] = {
              ...arr[idx],
              pos: { x, y },
              size: Math.random() < 0.2 ? clamp((arr[idx].size || 120) + (Math.random() - 0.5) * 30, 80, 250) : arr[idx].size,
              rotation: Math.random() < 0.15 ? ((arr[idx].rotation || 0) + Math.random() * 60) % 360 : arr[idx].rotation,
            };
            return arr;
          });
        }, gh.speed);
      })
      .filter(Boolean);
    return () => timers.forEach(clearInterval);
  }, [isActive, ghosts.length, movementPatterns, setGhosts]);

  if (!isActive) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 9999 }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {/* 유령 렌더링 */}
      {ghosts.map((gh, i) => {
        const g = getProcessedGhost(gh, i);
        if (!g?.pos || g.pos.x < 0) return null;
        return <Ghost key={`ghost-${i}`} gh={g} idx={i} onClick={() => catchGhost(i)} />;
      })}

      <ScorePanel left={ghosts.length} score={score} total={totalCaught} />

      {/* AR HUD (디버그) */}
      {location && (smoothHeading != null || compass?.heading != null) && (
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 20,
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: 12,
            borderRadius: 8,
            fontSize: 11,
            minWidth: 250,
            zIndex: 50,
          }}
        >
          <div style={{ color: "#4CAF50", fontWeight: "bold", marginBottom: 8 }}>🌍 AR 카메라 정보</div>
          <div>📍 내 위치: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</div>
          <div>🧭 카메라 방향(보정): {Math.round(wrap360((smoothHeading ?? compass.heading ?? 0) - calib))}°</div>
          <div>🎯 시야각: 60° (좌우 30°)</div>
          <div>📐 pitch(β): {orientation?.beta != null ? Math.round(orientation.beta) : "-" }°</div>
          <div style={{ marginTop: 6 }}>
            <button
              onClick={() => {
                const h = smoothHeading ?? compass?.heading ?? 0;
                setCalib(wrap360(h)); // 현재 바라보는 방향을 0°로 보정
              }}
              style={{ border: "none", borderRadius: 6, padding: "6px 10px", background: "#3A8049", color: "#fff", fontWeight: 800, cursor: "pointer" }}
            >
              방향 보정(지금이 정면)
            </button>
          </div>
        </div>
      )}

      {/* iOS 센서 권한 버튼(필요 시) */}
      {!supported && (
        <button
          onClick={() => {
            if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
              DeviceOrientationEvent.requestPermission().catch(() => {});
            }
          }}
          style={{
            position: "absolute",
            top: 300,
            left: 20,
            background: "#4CAF50",
            color: "white",
            border: "none",
            padding: "10px 15px",
            borderRadius: 8,
            fontSize: 12,
            zIndex: 50,
          }}
        >
          📱 센서 권한 요청
        </button>
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

      {/* 게임 완료 */}
      {ghosts.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.6)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.9)",
              color: "white",
              padding: 30,
              borderRadius: 20,
              border: "3px solid #FFD700",
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 15px 0", color: "#FFD700" }}>🎉 축하합니다! 🎉</h2>
            <p style={{ margin: 0, fontSize: 18 }}>모든 유령을 잡았습니다!</p>
          </div>
        </div>
      )}
    </div>
  );
}
