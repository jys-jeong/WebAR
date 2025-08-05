// components/SimpleAROverlay.jsx
import React, { useEffect, useRef, useState } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation"; // ✅ GPS 훅 추가
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";

const TICK = 100;

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);
  const lastStepRef = useRef([]);

  // ✅ 회전 감지 + GPS 위치
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

  // ✅ GPS 거리 계산 함수
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // 지구 반지름 (미터)
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ✅ 3가지 타입 유령 처리 함수 (확장)
  const getProcessedGhost = (ghost, index) => {
    if (!supported) return ghost;

    if (ghost.type === "gps-fixed" && location) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      console.log(
        `👻 유령 ${index} (${ghost.title}): 거리 ${distance.toFixed(
          0
        )}m, 최대거리 ${ghost.maxVisibleDistance}m`
      );

      const maxDistance = ghost.maxVisibleDistance || 100;
      if (distance > maxDistance) {
        console.log(`❌ 유령 ${index} 너무 멀어서 숨김`);
        return { ...ghost, pos: { x: -100, y: -100 } };
      }

      console.log(`✅ 유령 ${index} 표시됨`);
      const sizeScale = Math.max(0.3, 50 / Math.max(distance, 5));

      return {
        ...ghost,
        size: ghost.size * sizeScale,
        distance: Math.round(distance),
        opacity: Math.max(0.4, 1 - distance / maxDistance),
      };
    }

    // 다른 타입들...
    return ghost;
  };

  // ✅ GPS 위치 확보 시 새 게임 시작
  useEffect(() => {
    if (!location || !isActive) return;

    // 처음 위치를 얻었거나, 500m 이상 이동했을 때
    if (
      !lastLocation ||
      calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        location.latitude,
        location.longitude
      ) > 500
    ) {
      console.log("🌍 GPS 위치 기반 게임 시작:", location);
      resetGame(location); // 현재 위치를 resetGame에 전달
      setLastLocation(location);
    }
  }, [location, isActive, resetGame, lastLocation]);

  // AR 열릴 때 기본 게임 리셋 (GPS 없을 때)
  useEffect(() => {
    if (isActive && !location) {
      resetGame();
    }
  }, [isActive, location, resetGame]);

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

  // 실시간 움직임 로직 (Type B만 움직임)
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;

    console.log("Starting movement for", ghosts.length, "ghosts");

    const timers = ghosts
      .map((gh, index) => {
        // 🎯📍 고정 유령들은 움직이지 않음
        if (gh.type === "orientation-fixed" || gh.type === "gps-fixed")
          return null;

        return setInterval(() => {
          console.log(`Moving ghost ${index}`);

          setGhosts((prevGhosts) => {
            const newGhosts = [...prevGhosts];
            if (
              !newGhosts[index] ||
              newGhosts[index].type === "orientation-fixed" ||
              newGhosts[index].type === "gps-fixed"
            )
              return prevGhosts;

            // 움직임 패턴 (기존 코드 그대로)
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

      {/* ✅ 3가지 타입 유령 렌더링 */}
      {ghosts.map((gh, i) => {
        const processedGhost = getProcessedGhost(gh, i);

        // GPS 유령에 거리 표시
        if (processedGhost.distance !== undefined && processedGhost.pos.x > 0) {
          return (
            <div key={`ghost-wrapper-${i}`} style={{ position: "relative" }}>
              <Ghost
                gh={processedGhost}
                idx={i}
                onClick={() => catchGhost(i)}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${processedGhost.pos.x}%`,
                  top: `${processedGhost.pos.y - 5}%`,
                  transform: "translate(-50%, -100%)",
                  background: "rgba(255,215,0,0.9)",
                  color: "black",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: "bold",
                  zIndex: 25 + i,
                  pointerEvents: "none",
                }}
              >
                📍 {processedGhost.distance}m
              </div>
            </div>
          );
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
      {ghosts.map((gh, i) => {
        const processedGhost = getProcessedGhost(gh, i);

        console.log(
          `🎨 렌더링 ${i}: 타입=${gh.type}, 위치=(${processedGhost.pos.x}, ${processedGhost.pos.y})`
        );

        if (processedGhost.pos.x < 0) {
          console.log(`🚫 유령 ${i} 화면 밖이라 렌더링 안함`);
          return null;
        }

        // GPS 유령 거리 표시
        if (processedGhost.distance !== undefined && processedGhost.pos.x > 0) {
          return (
            <div key={`ghost-wrapper-${i}`} style={{ position: "relative" }}>
              <Ghost
                gh={processedGhost}
                idx={i}
                onClick={() => catchGhost(i)}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${processedGhost.pos.x}%`,
                  top: `${processedGhost.pos.y - 5}%`,
                  transform: "translate(-50%, -100%)",
                  background: "rgba(255,215,0,0.9)",
                  color: "black",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: "bold",
                  zIndex: 25 + i,
                  pointerEvents: "none",
                }}
              >
                📍 {processedGhost.distance}m
              </div>
            </div>
          );
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
      {/* ✅ GPS + 회전 정보 표시 */}
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
            🧭 현재: α={Math.round(orientation.alpha)}° β=
            {Math.round(orientation.beta)}°
          </div>

          {/* GPS 정보 */}
          {location ? (
            <>
              <hr style={{ margin: "6px 0", border: "1px solid #555" }} />
              <div style={{ color: "#4CAF50", fontSize: "10px" }}>
                📍 위치: {location.latitude.toFixed(6)},{" "}
                {location.longitude.toFixed(6)}
                <br />
                🎯 정확도: {location.accuracy?.toFixed(0)}m
              </div>
            </>
          ) : (
            <>
              <hr style={{ margin: "6px 0", border: "1px solid #555" }} />
              <div style={{ color: "#FFA726", fontSize: "10px" }}>
                📍 GPS 위치 확인 중...
              </div>
            </>
          )}

          {/* 회전 감지 유령 정보 */}
          {ghosts.find((g) => g.type === "orientation-fixed") && (
            <>
              <hr style={{ margin: "6px 0", border: "1px solid #555" }} />
              <div style={{ color: "#ff6b6b" }}>
                🎯 목표: α=
                {Math.round(
                  ghosts.find((g) => g.type === "orientation-fixed").targetAlpha
                )}
                ° β=
                {Math.round(
                  ghosts.find((g) => g.type === "orientation-fixed").targetBeta
                )}
                °
              </div>
              <div style={{ fontSize: "10px", color: "#ccc" }}>
                (±{ghosts.find((g) => g.type === "orientation-fixed").tolerance}
                ° 허용)
              </div>
            </>
          )}

          {/* GPS 유령 정보 */}
          {ghosts.find((g) => g.type === "gps-fixed") && (
            <>
              <hr style={{ margin: "6px 0", border: "1px solid #555" }} />
              <div style={{ color: "#FFD700" }}>
                🌍 GPS 유령:{" "}
                {ghosts.filter((g) => g.type === "gps-fixed").length}마리
              </div>
            </>
          )}
        </div>
      )}
      {/* ✅ 근처 유령 방향 안내 (기존 디버그 패널 아래에 추가) */}
      {location && ghosts.filter((g) => g.type === "gps-fixed").length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 120,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)",
            color: "white",
            padding: "15px",
            borderRadius: "15px",
            textAlign: "center",
            fontSize: "12px",
            zIndex: 60,
            minWidth: "250px",
            border: "2px solid #FFD700",
          }}
        >
          <div
            style={{
              color: "#FFD700",
              fontWeight: "bold",
              marginBottom: "10px",
            }}
          >
            🗺️ 주변 유령 위치
          </div>
          {ghosts
            .filter((g) => g.type === "gps-fixed")
            .slice(0, 3)
            .map((gh, i) => {
              const distance = calculateDistance(
                location.latitude,
                location.longitude,
                gh.gpsLat,
                gh.gpsLon
              );

              // 방향 계산 (8방위)
              const dLat = gh.gpsLat - location.latitude;
              const dLon = gh.gpsLon - location.longitude;
              const bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
              const normalizedBearing = (bearing + 360) % 360;
              const directions = [
                "북",
                "북동",
                "동",
                "남동",
                "남",
                "남서",
                "서",
                "북서",
              ];
              const directionIndex = Math.round(normalizedBearing / 45) % 8;
              const direction = directions[directionIndex];

              return (
                <div
                  key={i}
                  style={{
                    margin: "6px 0",
                    padding: "4px 8px",
                    borderRadius: "8px",
                    backgroundColor:
                      distance < 80
                        ? "rgba(76, 175, 80, 0.3)"
                        : "rgba(255, 167, 38, 0.3)",
                    color: distance < 80 ? "#4CAF50" : "#FFA726",
                  }}
                >
                  👻 <strong>{direction}</strong> 방향{" "}
                  <strong>{Math.round(distance)}m</strong>
                  {distance < 50 && (
                    <span style={{ color: "#4CAF50" }}> 🔥 가까움!</span>
                  )}
                </div>
              );
            })}
          <div style={{ fontSize: "10px", color: "#ccc", marginTop: "8px" }}>
            🚶‍♂️ 해당 방향으로 이동하면서 유령을 찾아보세요!
          </div>
        </div>
      )}
      {/* ✅ 권한 요청 버튼 (iOS용) */}
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
