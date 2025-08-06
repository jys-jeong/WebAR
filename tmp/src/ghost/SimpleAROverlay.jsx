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
  const [debugLogs, setDebugLogs] = useState([]); // ✅ 디버그 로그 저장
  const [showDebug, setShowDebug] = useState(true); // ✅ 디버그 패널 표시 여부

  const {
    ghosts,
    setGhosts,
    score,
    totalCaught,
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

  // ✅ 디버그 로그 추가 함수
  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [
      ...prev.slice(-20), // 최근 20개만 유지
      { time: timestamp, message }
    ]);
  };

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
      const inView = alphaDiff <= ghost.tolerance && betaDiff <= ghost.tolerance;

      if (!inView) {
        return { ...ghost, pos: { x: -100, y: -100 } };
      }
      return ghost;
    }

    // GPS 유령: 반경 내에 들어오면 이미지 표시
    if (ghost.type === "gps-fixed" && location) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.gpsLat,
        ghost.gpsLon
      );

      const maxDistance = ghost.maxVisibleDistance || 6;
      
      // ✅ UI 디버그 로그 추가
      addDebugLog(`GPS 유령${index}: ${distance.toFixed(1)}m (최대${maxDistance}m)`);

      // 반경 밖이면 숨김
      if (distance > maxDistance) {
        return { ...ghost, pos: { x: -100, y: -100 } };
      }

      // 반경 안이면 이미지 표시
      const sizeScale = Math.max(0.5, 3 / Math.max(distance, 1));
      
      addDebugLog(`GPS 유령${index} 화면에 표시! 크기: ${sizeScale.toFixed(2)}`);
      
      return {
        ...ghost,
        size: ghost.size * sizeScale,
        distance: distance.toFixed(1),
        opacity: Math.max(0.7, 1 - distance / maxDistance)
      };
    }

    return ghost;
  };

  // AR 열릴 때 한 번만 게임 리셋
  useEffect(() => {
    if (isActive) {
      // 처음 한 번만 게임 시작
      if (location && ghosts.length === 0) {
        addDebugLog(`GPS 위치 확보: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
        resetGame(location);
        addDebugLog("GPS 기반 게임 시작!");
      } else if (!location && ghosts.length === 0) {
        addDebugLog("GPS 없이 기본 게임 시작");
        resetGame();
      }
    }
  }, [isActive, location]);

  // ✅ GPS 위치 변경 로그
  useEffect(() => {
    if (location) {
      addDebugLog(`GPS 업데이트: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (정확도: ${location.accuracy}m)`);
    }
  }, [location]);

  // ✅ 유령 생성 로그
  useEffect(() => {
    if (ghosts.length > 0) {
      const gpsGhosts = ghosts.filter(g => g.type === "gps-fixed");
      const orientationGhosts = ghosts.filter(g => g.type === "orientation-fixed");
      const visibleGhosts = ghosts.filter(g => g.type === "always-visible");
      
      addDebugLog(`유령 생성 완료: GPS ${gpsGhosts.length}마리, 회전 ${orientationGhosts.length}마리, 일반 ${visibleGhosts.length}마리`);
    }
  }, [ghosts.length]);

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
        addDebugLog("카메라 시작 성공");
      })
      .catch(() => {
        addDebugLog("카메라 권한 오류");
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

      {/* 모든 타입의 유령 렌더링 */}
      {ghosts.map((gh, i) => {
        const processedGhost = getProcessedGhost(gh, i);
        
        // 화면 밖에 있으면 렌더링 안함
        if (processedGhost.pos.x < 0) {
          return null;
        }

        // GPS 유령에 거리 표시 추가
        if (gh.type === "gps-fixed" && processedGhost.distance) {
          return (
            <div key={`ghost-wrapper-${i}`} style={{ position: 'relative' }}>
              <Ghost
                gh={processedGhost}
                idx={i}
                onClick={() => {
                  addDebugLog(`GPS 유령 ${i} 클릭됨!`);
                  catchGhost(i);
                }}
              />
              {/* 거리 표시 */}
              <div style={{
                position: 'absolute',
                left: `${processedGhost.pos.x}%`,
                top: `${processedGhost.pos.y - 8}%`,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(255,215,0,0.9)',
                color: 'black',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold',
                zIndex: 25 + i,
                pointerEvents: 'none',
                border: '1px solid #FFD700'
              }}>
                📍 {processedGhost.distance}m
              </div>
            </div>
          );
        }

        // 다른 타입 유령들
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

      {/* ✅ 모바일 디버그 패널 - 접을 수 있음 */}
      <div style={{
        position: "absolute", top: 10, left: 10, right: 10,
        background: "rgba(0,0,0,0.9)", color: "white",
        borderRadius: "10px", zIndex: 100,
        border: "2px solid #4CAF50"
      }}>
        {/* 헤더 */}
        <div 
          style={{
            padding: "12px", 
            borderBottom: showDebug ? "1px solid #555" : "none",
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center"
          }}
          onClick={() => setShowDebug(!showDebug)}
        >
          <div style={{ fontSize: "14px", fontWeight: "bold", color: "#4CAF50" }}>
            🔍 디버그 정보 {showDebug ? "▼" : "▶"}
          </div>
          <div style={{ fontSize: "12px", color: "#ccc" }}>
            탭해서 {showDebug ? "접기" : "펼치기"}
          </div>
        </div>

        {/* 상세 정보 */}
        {showDebug && (
          <div style={{ padding: "12px", fontSize: "12px" }}>
            {/* 현재 상태 */}
            <div style={{ marginBottom: "10px" }}>
              <div style={{ color: "#FFD700", fontWeight: "bold", marginBottom: "5px" }}>
                📊 현재 상태
              </div>
              <div>🧭 방향: α={Math.round(orientation.alpha)}° β={Math.round(orientation.beta)}°</div>
              <div>📍 GPS: {location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : "위치 확인 중..."}</div>
              <div>🎯 정확도: {location?.accuracy?.toFixed(0)}m</div>
              <div>👻 전체 유령: {ghosts.length}마리</div>
            </div>

            {/* 유령별 상태 */}
            <div style={{ marginBottom: "10px" }}>
              <div style={{ color: "#FFD700", fontWeight: "bold", marginBottom: "5px" }}>
                👻 유령 상태
              </div>
              {ghosts.map((gh, i) => (
                <div key={i} style={{ 
                  margin: "3px 0", 
                  padding: "4px",
                  backgroundColor: gh.type === "gps-fixed" ? "rgba(33, 150, 243, 0.2)" : "rgba(76, 175, 80, 0.2)",
                  borderRadius: "4px"
                }}>
                  {i}: {gh.type} 
                  {gh.type === "gps-fixed" && location && (
                    <span style={{ color: "#4CAF50" }}>
                      - {calculateDistance(location.latitude, location.longitude, gh.gpsLat, gh.gpsLon).toFixed(1)}m
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* 최근 로그 */}
            <div>
              <div style={{ color: "#FFD700", fontWeight: "bold", marginBottom: "5px" }}>
                📝 최근 로그 (최근 5개)
              </div>
              <div style={{
                maxHeight: "120px", 
                overflowY: "auto",
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
                padding: "5px"
              }}>
                {debugLogs.slice(-5).map((log, i) => (
                  <div key={i} style={{ margin: "2px 0", fontSize: "10px" }}>
                    <span style={{ color: "#888" }}>[{log.time}]</span> {log.message}
                  </div>
                ))}
                {debugLogs.length === 0 && (
                  <div style={{ color: "#888", fontSize: "10px" }}>로그 없음</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GPS 유령 상태 안내 */}
      {location && ghosts.filter((g) => g.type === "gps-fixed").length > 0 && (
        <div style={{
          position: "absolute", bottom: 120, left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(33, 150, 243, 0.95)", color: "white",
          padding: "20px", borderRadius: "15px", textAlign: "center",
          fontSize: "14px", zIndex: 60, minWidth: "280px",
          border: "3px solid #2196F3"
        }}>
          <div style={{ color: "#E3F2FD", fontWeight: "bold", marginBottom: "15px" }}>
            👻 GPS 유령들
          </div>
          {ghosts.filter((g) => g.type === "gps-fixed").map((gh, i) => {
            const distance = calculateDistance(
              location.latitude, location.longitude,
              gh.gpsLat, gh.gpsLon
            );
            
            // 방향 계산
            const dLat = gh.gpsLat - location.latitude;
            const dLon = gh.gpsLon - location.longitude;
            const bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
            const normalizedBearing = (bearing + 360) % 360;
            const directions = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
            const directionIndex = Math.round(normalizedBearing / 45) % 8;
            const direction = directions[directionIndex];

            // 가시성 상태에 따른 표시
            const maxDistance = gh.maxVisibleDistance || 6;
            let statusColor, statusText, statusIcon;
            
            if (distance <= maxDistance) {
              statusColor = "#4CAF50";
              statusText = "화면에 보임!";
              statusIcon = "👻";
            } else if (distance < maxDistance + 2) {
              statusColor = "#FF9800";
              statusText = "거의 다 왔음";
              statusIcon = "🔥";
            } else {
              statusColor = "#9E9E9E";
              statusText = "너무 멀어서 안 보임";
              statusIcon = "📍";
            }

            return (
              <div key={i} style={{
                margin: "10px 0", padding: "12px 15px", borderRadius: "12px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: `2px solid ${statusColor}`, color: "white"
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: "5px"
                }}>
                  <span style={{ fontSize: "16px", fontWeight: "bold" }}>
                    {statusIcon} 유령 {i + 1}
                  </span>
                  <span style={{ color: statusColor, fontSize: "18px", fontWeight: "bold" }}>
                    {distance.toFixed(1)}m
                  </span>
                </div>
                <div style={{ fontSize: "12px", opacity: 0.8 }}>
                  📍 <strong>{direction}</strong> 방향 • <span style={{ color: statusColor }}>{statusText}</span>
                </div>
              </div>
            );
          })}
          <div style={{
            fontSize: "11px", color: "#B3E5FC", marginTop: "15px",
            padding: "8px", backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: "8px"
          }}>
            🚶‍♂️ {ghosts.find(g => g.type === "gps-fixed")?.maxVisibleDistance || 6}m 이내에 들어가면 유령이 나타납니다!
          </div>
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
            bottom: 50,
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
