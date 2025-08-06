// components/SimpleAROverlay.jsx
import React, { useEffect, useRef, useState } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import useCompass from "./useCompass";
import Ghost from "./Ghost";

const TICK = 100;

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);
  const lastStepRef = useRef([]);

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

  // 유령 처리 함수
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
      return {
        ...ghost,
        currentAlpha: orientation.alpha,
        currentBeta: orientation.beta,
        alphaDiff: alphaDiff,
        betaDiff: betaDiff,
      };
    }

    // location-direction 처리 (위치 + 방향 조건)
    if (ghost.type === "location-direction" && location && compass) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.targetLat,
        ghost.targetLon
      );

      const locationInRange = distance <= ghost.locationTolerance;

      const compassDiff = Math.min(
        Math.abs(compass.heading - ghost.targetCompass),
        360 - Math.abs(compass.heading - ghost.targetCompass)
      );
      const directionInRange = compassDiff <= ghost.compassTolerance;

      // 두 조건 모두 만족해야 보임
      if (!locationInRange || !directionInRange) {
        return {
          ...ghost,
          pos: { x: -100, y: -100 },
          currentDistance: distance,
          currentCompass: compass.heading,
          compassDiff: compassDiff,
          locationInRange: locationInRange,
          directionInRange: directionInRange,
        };
      }

      return {
        ...ghost,
        pos: { x: 50, y: 50 },
        size: ghost.size * 2.0,
        distance: distance.toFixed(1),
        opacity: 0.95,
        currentDistance: distance,
        currentCompass: compass.heading,
        compassDiff: compassDiff,
        locationInRange: locationInRange,
        directionInRange: directionInRange,
      };
    }

    // GPS 유령: 반경 내에 들어오면 이미지 표시
    if (ghost.type === "gps-fixed" && location) {
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
        };
      }

      return {
        ...ghost,
        pos: { x: 50, y: 50 },
        size: ghost.size * 1.5,
        distance: distance.toFixed(1),
        opacity: 0.9,
        currentDistance: distance,
        rotation: ghost.rotation || 0,
      };
    }

    // always-visible 로직
    return {
      ...ghost,
      currentX: ghost.pos?.x || 50,
      currentY: ghost.pos?.y || 50,
      currentRotation: ghost.rotation || 0,
    };
  };

  // AR 열릴 때 한 번만 게임 리셋
  useEffect(() => {
    if (isActive) {
      if (location && ghosts.length === 0) {
        resetGame(location);
      } else if (!location && ghosts.length === 0) {
        resetGame();
      }
    }
  }, [isActive, location]);

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
      .catch(() => {
        alert("카메라 권한이 필요합니다");
      });
    return () =>
      videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
  }, [isActive]);

  // 실시간 움직임 로직 (always-visible만)
  useEffect(() => {
    if (!isActive || ghosts.length === 0) return;

    const timers = ghosts
      .map((gh, index) => {
        if (
          gh.type === "orientation-fixed" ||
          gh.type === "gps-fixed" ||
          gh.type === "location-direction"
        )
          return null;

        return setInterval(() => {
          setGhosts((prevGhosts) => {
            const newGhosts = [...prevGhosts];
            if (
              !newGhosts[index] ||
              newGhosts[index].type === "orientation-fixed" ||
              newGhosts[index].type === "gps-fixed" ||
              newGhosts[index].type === "location-direction"
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
      timers.forEach(clearInterval);
    };
  }, [isActive, ghosts.length, movementPatterns, setGhosts]);

  if (!isActive) return null;

  // 유령 타입별 개수 계산
  const gpsGhosts = ghosts.filter((g) => g.type === "gps-fixed");
  const orientationGhosts = ghosts.filter(
    (g) => g.type === "orientation-fixed"
  );
  const locationDirectionGhosts = ghosts.filter(
    (g) => g.type === "location-direction"
  );
  const visibleGhosts = ghosts.filter((g) => g.type === "always-visible");

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
      {/* 카메라 배경 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* 유령들만 렌더링 */}
      {ghosts.map((gh, i) => {
        const processedGhost = getProcessedGhost(gh, i);

        // 화면 밖에 있으면 렌더링 안함
        if (processedGhost.pos.x < 0) {
          return null;
        }

        // 유령 렌더링
        return (
          <Ghost
            key={`ghost-${i}`}
            gh={processedGhost}
            idx={i}
            onClick={() => catchGhost(i)}
          />
        );
      })}

      {/* ✅ 기존 작은 상황판 - 유령 타입별 개수 */}
      <div
        style={{
          position: "absolute",
          top: 15,
          left: 15,
          background: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "12px 15px",
          borderRadius: "12px",
          fontSize: "12px",
          zIndex: 50,
          minWidth: "200px",
          border: "2px solid rgba(255,255,255,0.2)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: "bold",
            marginBottom: "8px",
            color: "#FFD700",
            textAlign: "center",
          }}
        >
          👻 유령 현황
        </div>

        {/* 유령 타입별 개수 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          {/* GPS 유령 */}
          <div
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 4px",
              background: "rgba(33, 150, 243, 0.3)",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "16px", marginBottom: "2px" }}>🌍</div>
            <div style={{ fontSize: "10px", color: "#81D4FA" }}>GPS</div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: gpsGhosts.length > 0 ? "#4CAF50" : "#999",
              }}
            >
              {gpsGhosts.length}
            </div>
          </div>

          {/* 회전감지 유령 */}
          <div
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 4px",
              background: "rgba(255, 107, 107, 0.3)",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "16px", marginBottom: "2px" }}>🎯</div>
            <div style={{ fontSize: "10px", color: "#FFAB91" }}>회전</div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: orientationGhosts.length > 0 ? "#4CAF50" : "#999",
              }}
            >
              {orientationGhosts.length}
            </div>
          </div>

          {/* 위치+방향 유령 */}
          <div
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 4px",
              background: "rgba(255, 215, 0, 0.3)",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "16px", marginBottom: "2px" }}>🧭</div>
            <div style={{ fontSize: "10px", color: "#FFECB3" }}>위치+방향</div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: locationDirectionGhosts.length > 0 ? "#4CAF50" : "#999",
              }}
            >
              {locationDirectionGhosts.length}
            </div>
          </div>

          {/* 일반 유령 */}
          <div
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 4px",
              background: "rgba(76, 175, 80, 0.3)",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "16px", marginBottom: "2px" }}>👻</div>
            <div style={{ fontSize: "10px", color: "#C8E6C9" }}>일반</div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: visibleGhosts.length > 0 ? "#4CAF50" : "#999",
              }}
            >
              {visibleGhosts.length}
            </div>
          </div>
        </div>

        {/* 전체 개수 */}
        <div
          style={{
            textAlign: "center",
            marginTop: "8px",
            fontSize: "11px",
            color: "#FFD700",
            fontWeight: "bold",
          }}
        >
          총 {ghosts.length}마리 남음
        </div>
      </div>

      {/* ✅ 새로 추가: 유령 상세 정보 패널 */}
      <div
        style={{
          position: "absolute",
          bottom: 15,
          left: 15,
          background: "rgba(0,0,0,0.85)",
          color: "white",
          padding: "10px 12px",
          borderRadius: "10px",
          fontSize: "11px",
          zIndex: 50,
          maxWidth: "300px",
          border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: "bold",
            marginBottom: "8px",
            color: "#FFD700",
            textAlign: "center",
          }}
        >
          📊 유령 상세 정보
        </div>

        {/* 회전 유령 정보 */}
        {orientationGhosts.map((gh, i) => {
          const processedGhost = getProcessedGhost(gh, i);
          const isVisible = processedGhost.pos.x > 0;

          return (
            <div
              key={`orientation-${i}`}
              style={{
                marginBottom: "8px",
                padding: "6px 8px",
                background: "rgba(255, 107, 107, 0.2)",
                borderRadius: "6px",
                border: "1px solid rgba(255, 107, 107, 0.4)",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "3px",
                  color: "#FF6B6B",
                }}
              >
                🎯 회전감지 유령
              </div>
              <div style={{ fontSize: "10px", lineHeight: "1.3" }}>
                목표: α{gh.targetAlpha.toFixed(0)}° β{gh.targetBeta.toFixed(0)}°
                <br />
                현재: α{processedGhost.currentAlpha?.toFixed(0)}° β
                {processedGhost.currentBeta?.toFixed(0)}°<br />
                차이: α{processedGhost.alphaDiff?.toFixed(0)}° β
                {processedGhost.betaDiff?.toFixed(0)}°<br />
                <span style={{ color: isVisible ? "#4CAF50" : "#FF9800" }}>
                  상태: {isVisible ? "👁️ 보임" : "❌ 각도 불일치"}
                </span>
              </div>
            </div>
          );
        })}
        {/* ✅ 새로 추가: 현재 센서 정보 */}
        <div
          style={{
            marginBottom: "8px",
            padding: "6px 8px",
            background: "rgba(76, 175, 80, 0.2)",
            borderRadius: "6px",
            border: "1px solid rgba(76, 175, 80, 0.4)",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "3px",
              color: "#4CAF50",
            }}
          >
            📱 현재 센서 정보
          </div>
          <div style={{ fontSize: "10px", lineHeight: "1.3" }}>
            {/* α, β 각도 */}
            α: {Math.round(orientation.alpha)}° β:{" "}
            {Math.round(orientation.beta)}°<br />
            {/* GPS 위치 */}
            {location ? (
              <>
                위도: {location.latitude.toFixed(6)}
                <br />
                경도: {location.longitude.toFixed(6)}
                <br />
                정확도: ±{location.accuracy?.toFixed(0)}m<br />
              </>
            ) : (
              <>
                위치: GPS 신호 확인 중...
                <br />
              </>
            )}
            {/* 나침반 방향 */}
            {compass ? (
              <>방향: {compass.heading.toFixed(0)}° (나침반)</>
            ) : (
              <>방향: 나침반 신호 확인 중...</>
            )}
          </div>
        </div>
        {/* GPS 유령 정보 */}
        {gpsGhosts.map((gh, i) => {
          const processedGhost = getProcessedGhost(gh, i);
          const isVisible = processedGhost.pos.x > 0;

          return (
            <div
              key={`gps-${i}`}
              style={{
                marginBottom: "8px",
                padding: "6px 8px",
                background: "rgba(33, 150, 243, 0.2)",
                borderRadius: "6px",
                border: "1px solid rgba(33, 150, 243, 0.4)",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "3px",
                  color: "#2196F3",
                }}
              >
                🌍 GPS 유령
              </div>
              <div style={{ fontSize: "10px", lineHeight: "1.3" }}>
                위치: {gh.gpsLat.toFixed(6)}, {gh.gpsLon.toFixed(6)}
                <br />
                {location && (
                  <>
                    거리: {processedGhost.currentDistance?.toFixed(1)}m<br />
                    범위: {gh.maxVisibleDistance}m 이내
                    <br />
                    <span style={{ color: isVisible ? "#4CAF50" : "#FF9800" }}>
                      상태: {isVisible ? "👁️ 보임" : "📍 범위 밖"}
                    </span>
                  </>
                )}
                {!location && (
                  <span style={{ color: "#FF9800" }}>GPS 신호 확인 중...</span>
                )}
              </div>
            </div>
          );
        })}

        {/* 위치+방향 유령 정보 */}
        {locationDirectionGhosts.map((gh, i) => {
          const processedGhost = getProcessedGhost(gh, i);
          const isVisible = processedGhost.pos.x > 0;

          return (
            <div
              key={`location-direction-${i}`}
              style={{
                marginBottom: "8px",
                padding: "6px 8px",
                background: "rgba(255, 215, 0, 0.2)",
                borderRadius: "6px",
                border: "1px solid rgba(255, 215, 0, 0.4)",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "3px",
                  color: "#FFD700",
                }}
              >
                🧭 위치+방향 유령
              </div>
              <div style={{ fontSize: "10px", lineHeight: "1.3" }}>
                {location && compass ? (
                  <>
                    위치: {gh.targetLat.toFixed(6)}, {gh.targetLon.toFixed(6)}
                    <br />
                    거리: {processedGhost.currentDistance?.toFixed(1)}m /{" "}
                    {gh.locationTolerance}m<br />
                    목표방향: {gh.targetCompass}° (±{gh.compassTolerance}°)
                    <br />
                    현재방향: {processedGhost.currentCompass?.toFixed(0)}°<br />
                    <span
                      style={{
                        color: processedGhost.locationInRange
                          ? "#4CAF50"
                          : "#FF9800",
                      }}
                    >
                      위치: {processedGhost.locationInRange ? "✅" : "❌"}
                    </span>{" "}
                    <span
                      style={{
                        color: processedGhost.directionInRange
                          ? "#4CAF50"
                          : "#FF9800",
                      }}
                    >
                      방향: {processedGhost.directionInRange ? "✅" : "❌"}
                    </span>
                    <br />
                    <span style={{ color: isVisible ? "#4CAF50" : "#FF9800" }}>
                      상태: {isVisible ? "👁️ 보임" : "🚫 조건 불만족"}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "#FF9800" }}>
                    GPS 또는 나침반 신호 확인 중...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 15,
          right: 15,
          width: 45,
          height: 45,
          borderRadius: "50%",
          fontSize: 20,
          color: "#fff",
          background: "rgba(255, 68, 68, 0.8)",
          border: "none",
          cursor: "pointer",
          zIndex: 60,
          backdropFilter: "blur(10px)",
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
