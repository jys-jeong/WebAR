// components/SimpleAROverlay.jsx
import React, { useEffect, useRef, useState } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import useCompass from "./useCompass"; // ✅ 나침반 추가
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

const TICK = 100;

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);

  const { orientation, supported } = useDeviceOrientation();
  const { location } = useGeoLocation();
  const { compass } = useCompass(); // ✅ 나침반 사용

  const {
    ghosts,
    setGhosts,
    score,
    totalCaught,
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

  // GPS 거리 계산 함수
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

  // ✅ 방위각 계산 (유령이 있는 방향)
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    
    const dLon = toRad(lon2 - lon1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360; // 0-360도 범위로 정규화
  };

  // ✅ 카메라 시야각 내에 있는지 확인
  const isInCameraView = (ghostBearing, cameraBearing, fov = 60) => {
    // 카메라 시야각의 절반
    const halfFov = fov / 2;
    
    // 두 각도의 차이 계산 (최단거리)
    let angleDiff = Math.abs(ghostBearing - cameraBearing);
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }
    
    return angleDiff <= halfFov;
  };

  // ✅ AR 카메라 기반 유령 처리 함수
  const getProcessedGhost = (ghost, index) => {
    if (!supported) return ghost;

    // 🎯 기존 orientation-fixed 로직 (그대로 유지)
    if (ghost.type === "orientation-fixed") {
      const alphaDiff = Math.min(
        Math.abs(orientation.alpha - ghost.targetAlpha),
        360 - Math.abs(orientation.alpha - ghost.targetAlpha)
      );
      const betaDiff = Math.abs(orientation.beta - ghost.targetBeta);
      const inView = alphaDiff <= ghost.tolerance && betaDiff <= ghost.tolerance;

      if (!inView) {
        return { ...ghost, pos: { x: -100, y: -100 } };
      }
      return ghost;
    }

    // 🌍 GPS 유령: AR 카메라 시야각 기반 표시
    if (ghost.type === "gps-fixed" && location && compass) {
      // 거리 계산
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      console.log(`👻 GPS 유령: 거리 ${distance.toFixed(1)}m`);

      // 최대 표시 거리 체크
      const maxDistance = ghost.maxVisibleDistance || 100;
      if (distance > maxDistance) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          reason: "거리 초과"
        };
      }

      // 유령이 있는 방향 계산
      const ghostBearing = calculateBearing(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      // 현재 카메라가 바라보는 방향
      const cameraBearing = compass.heading;

      // ✅ 카메라 시야각 내에 있는지 확인
      const inView = isInCameraView(ghostBearing, cameraBearing, 60); // 60도 시야각

      console.log(`📹 카메라 방향: ${cameraBearing.toFixed(0)}°, 유령 방향: ${ghostBearing.toFixed(0)}°, 시야 내: ${inView}`);

      if (!inView) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          ghostBearing: ghostBearing,
          cameraBearing: cameraBearing,
          reason: "시야각 밖"
        };
      }

      // ✅ 시야각 내에 있으면 화면에 표시
      // 카메라 중심에서 유령까지의 각도 차이를 화면 좌표로 변환
      let angleDiff = ghostBearing - cameraBearing;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      // 화면 X 좌표 계산 (중심 50%, 좌우로 시야각에 따라 이동)
      const screenX = 50 + (angleDiff / 60) * 80; // 60도 시야각을 80% 화면 너비에 매핑
      const screenY = 50; // 화면 중앙 높이

      // 거리에 따른 크기 조절
      const sizeScale = Math.max(0.5, 50 / Math.max(distance, 1));

      return {
        ...ghost,
        pos: { x: Math.max(10, Math.min(90, screenX)), y: screenY },
        size: (ghost.size || 120) * sizeScale,
        opacity: Math.max(0.7, 1 - distance / maxDistance),
        currentDistance: distance,
        ghostBearing: ghostBearing,
        cameraBearing: cameraBearing,
        reason: "표시됨"
      };
    }

    // 👻 always-visible 로직 (그대로 유지)
    return ghost;
  };

  // AR 열릴 때 한 번만 게임 리셋
  useEffect(() => {
    if (isActive) {
      if (location) {
        resetGame(location);
      } else {
        resetGame();
      }
    }
  }, [isActive]);

  // 카메라 설정 (그대로 유지)
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
    return () =>
      videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
  }, [isActive]);

  // 실시간 움직임 로직 (always-visible만, 그대로 유지)
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;

    const timers = ghosts
      .map((gh, index) => {
        if (gh.type === "orientation-fixed" || gh.type === "gps-fixed")
          return null;

        return setInterval(() => {
          setGhosts((prevGhosts) => {
            const newGhosts = [...prevGhosts];
            if (
              !newGhosts[index] ||
              newGhosts[index].type === "orientation-fixed" ||
              newGhosts[index].type === "gps-fixed"
            )
              return prevGhosts;

            // 기존 움직임 로직...
            const pattern = movementPatterns[Math.floor(Math.random() * movementPatterns.length)];
            let { x, y } = newGhosts[index].pos;
            const now = Date.now();

            switch (pattern) {
              case "random-jump":
                x = Math.random() * 80 + 10;
                y = Math.random() * 80 + 10;
                break;
              case "smooth-slide":
                x = Math.max(10, Math.min(90, x + (Math.random() - 0.5) * 25));
                y = Math.max(10, Math.min(90, y + (Math.random() - 0.5) * 25));
                break;
              // ... 기타 패턴들
            }

            newGhosts[index] = {
              ...newGhosts[index],
              pos: { x, y },
              size: Math.random() < 0.2 ? Math.max(80, Math.min(250, newGhosts[index].size + (Math.random() - 0.5) * 30)) : newGhosts[index].size,
              rotation: Math.random() < 0.15 ? (newGhosts[index].rotation + Math.random() * 60) % 360 : newGhosts[index].rotation,
            };

            return newGhosts;
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

      {/* ✅ 모든 유령 렌더링 (GPS 유령도 포함) */}
      {ghosts.map((gh, i) => {
        const processedGhost = getProcessedGhost(gh, i);

        // 화면 밖에 있으면 렌더링 안함
        if (processedGhost.pos.x < 0) {
          return null;
        }

        return (
          <Ghost
            key={`ghost-${i}`}
            gh={processedGhost}
            idx={i}
            onClick={() => catchGhost(i)}
          />
        );
      })}

      <ScorePanel left={ghosts.length} score={score} total={totalCaught} />

      {/* ✅ AR 정보 표시 */}
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

          {/* GPS 유령 정보 */}
          {ghosts.filter(g => g.type === "gps-fixed").map((gh, i) => {
            const processedGhost = getProcessedGhost(gh, i);
            
            return (
              <div key={i} style={{ marginTop: "8px" }}>
                <div style={{ color: "#FFD700", fontWeight: "bold" }}>
                  👻 특정 위치 유령
                </div>
                <div>📍 유령 위치: {gh.gpsLat}, {gh.gpsLon}</div>
                <div>📏 거리: {processedGhost.currentDistance?.toFixed(1)}m</div>
                <div>🧭 유령 방향: {processedGhost.ghostBearing?.toFixed(0)}°</div>
                <div style={{ 
                  color: processedGhost.reason === "표시됨" ? "#4CAF50" : "#FF9800" 
                }}>
                  📺 상태: {processedGhost.reason}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 권한 요청 버튼 */}
      {!supported && (
        <button
          onClick={() => {
            if (typeof DeviceOrientationEvent !== "undefined" && 
                typeof DeviceOrientationEvent.requestPermission === "function") {
              DeviceOrientationEvent.requestPermission();
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
            borderRadius: "8px",
            fontSize: "12px",
            zIndex: 50,
          }}
        >
          📱 센서 권한 요청
        </button>
      )}

      {/* 닫기 버튼 */}
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

      {/* 게임 완료 메시지 */}
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
          <h2 style={{ margin: "0 0 15px 0", color: "#FFD700" }}>
            🎉 축하합니다! 🎉
          </h2>
          <p style={{ margin: "0", fontSize: "18px" }}>
            모든 유령을 잡았습니다!
          </p>
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
