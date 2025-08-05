// components/SimpleAROverlay.jsx
import React, { useEffect, useRef, useState } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

const TICK = 100;

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);
  const lastStepRef = useRef([]);

  const { orientation, supported } = useDeviceOrientation();
  const { location } = useGeoLocation();

  const [lastLocation, setLastLocation] = useState(null);

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

  // 3가지 타입 유령 처리 함수
  const getProcessedGhost = (ghost, index) => {
    if (!supported) return ghost;

    // orientation-fixed 로직
    if (ghost.type === "orientation-fixed") {
      const alphaDiff = Math.min(
        Math.abs(orientation.alpha - ghost.targetAlpha),
        360 - Math.abs(orientation.alpha - ghost.targetAlpha)
      );
      const betaDiff = Math.abs(orientation.beta - ghost.targetBeta);
      const inView =
        alphaDiff <= ghost.tolerance && betaDiff <= ghost.tolerance;

      if (!inView) {
        return { ...ghost, pos: { x: -100, y: -100 } };
      }
      return ghost;
    }

    // GPS 유령은 항상 숨김 (거리 정보만 저장)
    if (ghost.type === "gps-fixed" && location) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      console.log(`👻 GPS 유령 ${index}: 현재 거리 ${distance.toFixed(1)}m`);

      return {
        ...ghost,
        pos: { x: -100, y: -100 }, // 이미지 숨김
        currentDistance: distance.toFixed(1),
      };
    }

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

  // 실시간 움직임 로직 (always-visible만)
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;

    console.log("Starting movement for", ghosts.length, "ghosts");

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
      })
      .filter(Boolean);

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

      {/* 유령 렌더링 (GPS 유령 제외) */}
      {ghosts.map((gh, i) => {
        const processedGhost = getProcessedGhost(gh, i);

        if (gh.type === "gps-fixed") {
          return null; // GPS 유령은 이미지 렌더링 안함
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

      <ScorePanel left={ghosts.filter(g => g.type !== "gps-fixed").length} score={score} total={totalCaught} />

      {/* ✅ GPS 유령 실시간 거리 표시 (단일 UI) */}
      {location && ghosts.filter((g) => g.type === "gps-fixed").length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 120,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(33, 150, 243, 0.95)",
            color: "white",
            padding: "20px",
            borderRadius: "15px",
            textAlign: "center",
            fontSize: "14px",
            zIndex: 60,
            minWidth: "280px",
            border: "3px solid #2196F3",
            boxShadow: "0 4px 20px rgba(33, 150, 243, 0.3)",
          }}
        >
          <div
            style={{
              color: "#E3F2FD",
              fontWeight: "bold",
              marginBottom: "15px",
              fontSize: "16px",
            }}
          >
            🎯 숨겨진 보물들
          </div>
          {ghosts
            .filter((g) => g.type === "gps-fixed")
            .map((gh, i) => {
              const distance = calculateDistance(
                location.latitude,
                location.longitude,
                gh.gpsLat,
                gh.gpsLon
              );

              // 방향 계산
              const dLat = gh.gpsLat - location.latitude;
              const dLon = gh.gpsLon - location.longitude;
              const bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
              const normalizedBearing = (bearing + 360) % 360;
              const directions = [
                "북", "북동", "동", "남동", "남", "남서", "서", "북서",
              ];
              const directionIndex = Math.round(normalizedBearing / 45) % 8;
              const direction = directions[directionIndex];

              // 거리에 따른 상태 표시
              let statusColor, statusText, statusIcon;
              if (distance < 2) {
                statusColor = "#4CAF50";
                statusText = "바로 여기!";
                statusIcon = "🎉";
              } else if (distance < 5) {
                statusColor = "#FF9800";
                statusText = "매우 가까움";
                statusIcon = "🔥";
              } else if (distance < 10) {
                statusColor = "#2196F3";
                statusText = "가까움";
                statusIcon = "⚡";
              } else {
                statusColor = "#9E9E9E";
                statusText = "멀음";
                statusIcon = "📍";
              }

              return (
                <div
                  key={i}
                  style={{
                    margin: "10px 0",
                    padding: "12px 15px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: `2px solid ${statusColor}`,
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "5px",
                    }}
                  >
                    <span style={{ fontSize: "16px", fontWeight: "bold" }}>
                      {statusIcon} 보물 {i + 1}
                    </span>
                    <span
                      style={{
                        color: statusColor,
                        fontSize: "18px",
                        fontWeight: "bold",
                      }}
                    >
                      {distance.toFixed(1)}m
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", opacity: 0.8 }}>
                    📍 <strong>{direction}</strong> 방향 • <span style={{ color: statusColor }}>{statusText}</span>
                  </div>
                </div>
              );
            })}
          <div
            style={{
              fontSize: "11px",
              color: "#B3E5FC",
              marginTop: "15px",
              padding: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
            }}
          >
            🚶‍♂️ 2m 이내에 도달하면 보물 획득!
          </div>
        </div>
      )}

      {/* 디버그 정보 패널 */}
      {supported && (
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
            minWidth: "200px",
          }}
        >
          <div>
            🧭 현재: α={Math.round(orientation.alpha)}° β={Math.round(orientation.beta)}°
          </div>

          {/* GPS 실시간 정보 */}
          {location && (
            <>
              <hr style={{ margin: "6px 0", border: "1px solid #555" }} />
              <div style={{ color: "#4CAF50", fontSize: "10px" }}>
                📍 위치: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}<br />
                🎯 정확도: {location.accuracy?.toFixed(0)}m
                <div style={{ color: "#FFD700", marginTop: "4px" }}>
                  🔄 실시간 갱신 중...
                </div>
              </div>
            </>
          )}

          {/* orientation-fixed 정보 */}
          {ghosts.find((g) => g.type === "orientation-fixed") && (
            <>
              <hr style={{ margin: "6px 0", border: "1px solid #555" }} />
              <div style={{ color: "#ff6b6b" }}>
                🎯 목표: α={Math.round(ghosts.find((g) => g.type === "orientation-fixed").targetAlpha)}° 
                β={Math.round(ghosts.find((g) => g.type === "orientation-fixed").targetBeta)}°
              </div>
            </>
          )}

          {/* GPS 유령 정보 */}
          {ghosts.find((g) => g.type === "gps-fixed") && (
            <>
              <hr style={{ margin: "6px 0", border: "1px solid #555" }} />
              <div style={{ color: "#FFD700" }}>
                🌍 GPS 유령: {ghosts.filter((g) => g.type === "gps-fixed").length}마리
              </div>
            </>
          )}
        </div>
      )}

      {/* iOS 권한 요청 버튼 */}
      {!supported && (
        <button
          onClick={() => {
            if (
              typeof DeviceOrientationEvent !== "undefined" &&
              typeof DeviceOrientationEvent.requestPermission === "function"
            ) {
              DeviceOrientationEvent.requestPermission();
            }
          }}
          style={{
            position: "absolute",
            top: 120,
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

      {ghosts.filter(g => g.type !== "gps-fixed").length === 0 && (
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
