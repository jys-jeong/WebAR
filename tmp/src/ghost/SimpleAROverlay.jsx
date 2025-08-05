// components/SimpleAROverlay.jsx
import React, { useEffect, useRef } from "react";
import useGhostGame from "./useGhostGame";
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

const TICK = 100; // 100ms 간격으로 업데이트

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);
  const lastStepRef = useRef([]);

  const {
    ghosts,
    setGhosts,
    score,
    totalCaught,
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

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

  // ✅ 실시간 움직임 로직
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;

    console.log("Starting movement for", ghosts.length, "ghosts");

    // ✅ 각 유령별로 독립적인 타이머 생성 (기존 방식 개선)
    const timers = ghosts.map((gh, index) => {
      return setInterval(() => {
        console.log(`Moving ghost ${index}`); // 디버깅용

        setGhosts((prevGhosts) => {
          const newGhosts = [...prevGhosts];
          if (!newGhosts[index]) return prevGhosts; // 안전 체크

          // 패턴 선택
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

            default: // pause
              break;
          }

          // 추가 효과
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

          // 업데이트
          newGhosts[index] = {
            ...newGhosts[index],
            pos: { x, y },
            size,
            rotation,
            
          };

          return newGhosts;
        });
      }, gh.speed); // 각 유령의 개별 속도 사용
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
      {/* 카메라 비디오 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* ✅ Ghost 컴포넌트들 렌더링 */}
      {ghosts.map((gh, i) => (
        <Ghost
          key={`ghost-${i}`}
          gh={gh}
          idx={i}
          onClick={() => catchGhost(i)}
        />
      ))}

      {/* 스코어 패널 */}
      <ScorePanel left={ghosts.length} score={score} total={totalCaught} />

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

      {/* 축하 메시지 */}
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

      {/* CSS 애니메이션 */}
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
