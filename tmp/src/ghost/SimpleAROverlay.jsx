// components/SimpleAROverlay.jsx
import React, { useEffect, useRef } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation"; 
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

const TICK = 100;

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);
  const lastStepRef = useRef([]);
  
  // ✅ 회전 감지 추가
  const { orientation, supported } = useDeviceOrientation();

  const {
    ghosts,
    setGhosts,
    score,
    totalCaught,
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

  // ✅ 회전 기반 유령 위치 계산 함수 추가
  const getRotatedGhost = (ghost, index) => {
    if (!supported) return ghost;

    // 각 유령마다 다른 기준 방향 설정 (0~360도)
    const baseDirection = (index * 60) % 360;
    const currentDirection = orientation.alpha;
    
    // 현재 방향과 유령 기준 방향의 차이 계산
    let angleDiff = ((baseDirection - currentDirection + 360) % 360);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    
    // 시야각 내에 있는지 확인 (±60도)
    const inView = angleDiff <= 60;
    
    if (!inView) {
      // 화면 밖으로 이동
      return { 
        ...ghost, 
        pos: { x: -100, y: -100 }
      };
    }

    // 회전에 따른 위치 보정
    const rotationOffset = (currentDirection - baseDirection) * 0.2;
    const adjustedX = Math.max(5, Math.min(95, ghost.pos.x + rotationOffset));
    const adjustedY = ghost.pos.y + Math.sin(orientation.beta * Math.PI / 180) * 5;

    return {
      ...ghost,
      pos: {
        x: adjustedX,
        y: Math.max(5, Math.min(95, adjustedY))
      }
    };
  };

  // AR 열릴 때 게임 리셋
  useEffect(() => {
    if (isActive) resetGame();
  }, [isActive, resetGame]);

  // 카메라 설정
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

  // 실시간 움직임 로직 (기존 코드 그대로 유지)
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;

    console.log("Starting movement for", ghosts.length, "ghosts");

    const timers = ghosts.map((gh, index) => {
      return setInterval(() => {
        console.log(`Moving ghost ${index}`);

        setGhosts((prevGhosts) => {
          const newGhosts = [...prevGhosts];
          if (!newGhosts[index]) return prevGhosts;

          const pattern =
            movementPatterns[
              Math.floor(Math.random() * movementPatterns.length)
            ];
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

            case "circular":
              const angle = now * 0.002 + index;
              x = 50 + Math.cos(angle) * 25;
              y = 50 + Math.sin(angle) * 25;
              break;

            case "zigzag":
              x = Math.abs(Math.sin(now * 0.003 + index)) * 80 + 10;
              y = Math.max(10, Math.min(90, y + (Math.random() - 0.5) * 20));
              break;

            case "bounce":
              x = Math.max(
                10,
                Math.min(90, x + Math.sin(now * 0.004 + index) * 20)
              );
              y = Math.max(
                10,
                Math.min(90, y + Math.cos(now * 0.004 + index) * 20)
              );
              break;

            case "spiral":
              const spiralAngle = now * 0.003 + index;
              const radius = 15 + Math.sin(spiralAngle * 0.5) * 10;
              x = 50 + Math.cos(spiralAngle) * radius;
              y = 50 + Math.sin(spiralAngle) * radius;
              break;

            case "shake":
              x = Math.max(10, Math.min(90, x + (Math.random() - 0.5) * 8));
              y = Math.max(10, Math.min(90, y + (Math.random() - 0.5) * 8));
              break;

            default:
              break;
          }

          const size =
            Math.random() < 0.2
              ? Math.max(
                  80,
                  Math.min(
                    250,
                    newGhosts[index].size + (Math.random() - 0.5) * 30
                  )
                )
              : newGhosts[index].size;
          const rotation =
            Math.random() < 0.15
              ? (newGhosts[index].rotation + Math.random() * 60) % 360
              : newGhosts[index].rotation;

          newGhosts[index] = {
            ...newGhosts[index],
            pos: { x, y },
            size,
            rotation,
          };

          return newGhosts;
        });
      }, gh.speed);
    });

    return () => {
      console.log("Clearing movement timers");
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

      {/* ✅ 회전 기반 Ghost 렌더링 */}
      {ghosts.map((gh, i) => {
        const rotatedGhost = getRotatedGhost(gh, i);
        return (
          <Ghost
            key={`ghost-${i}`}
            gh={rotatedGhost}
            idx={i}
            onClick={() => catchGhost(i)}
          />
        );
      })}

      <ScorePanel left={ghosts.length} score={score} total={totalCaught} />

      {/* ✅ 회전 정보 표시 (디버깅용) */}
      {supported && (
        <div style={{
          position: "absolute", top: 100, left: 20,
          background: "rgba(0,0,0,0.7)", color: "white",
          padding: "10px", borderRadius: "8px", fontSize: "11px",
          zIndex: 50
        }}>
          <div>🧭 방향: {Math.round(orientation.alpha)}°</div>
          <div>📱 기울기: {Math.round(orientation.beta)}°</div>
        </div>
      )}

      {/* ✅ 권한 요청 버튼 (iOS용) */}
      {!supported && (
        <button 
          onClick={() => {
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function') {
              DeviceOrientationEvent.requestPermission();
            }
          }}
          style={{
            position: "absolute", top: 120, left: 20,
            background: "#4CAF50", color: "white",
            border: "none", padding: "10px 15px",
            borderRadius: "8px", fontSize: "12px", zIndex: 50
          }}>
          📱 회전 감지 활성화
        </button>
      )}

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
          <p style={{ margin: "10px 0 0 0", fontSize: "14px", color: "#ccc" }}>
            새로운 라운드가 곧 시작됩니다...
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes ghostCatch {
          0% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
          }
          25% {
            transform: translate(-50%, -50%) scale(1.3) rotate(90deg);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1) rotate(180deg);
          }
          75% {
            transform: translate(-50%, -50%) scale(1.2) rotate(270deg);
          }
          100% {
            transform: translate(-50%, -50%) scale(0) rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
