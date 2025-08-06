// components/SimpleAROverlay.jsx
import React, { useEffect, useRef, useState } from "react";
import useGhostGame from "./useGhostGame";
import useDeviceOrientation from "./useDeviceOrientation";
import useGeoLocation from "./useGeoLocation";
import Ghost from "./Ghost";
import ScorePanel from "./ScorePanel";
import useCompass from "./useCompass";
const TICK = 100;

export default function SimpleAROverlay({ isActive, onClose }) {
  const videoRef = useRef(null);
  const lastStepRef = useRef([]);

  const { orientation, supported } = useDeviceOrientation();
  const { location } = useGeoLocation();
  const { compass } = useCompass();

  const [lastLocation, setLastLocation] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(true);
  const [showGhostInfo, setShowGhostInfo] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(true); // ✅ 좌표 표시 여부

  const {
    ghosts,
    setGhosts,
    score,
    totalCaught,
    resetGame,
    catchGhost,
    movementPatterns,
  } = useGhostGame();

  // 디버그 로그 추가 함수
  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-20), { time: timestamp, message }]);
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

  // ✅ 좌표 복사 함수
  const copyCoordinates = () => {
    if (location) {
      const coordText = `${location.latitude}, ${location.longitude}`;
      navigator.clipboard
        .writeText(coordText)
        .then(() => {
          addDebugLog("좌표 복사됨: " + coordText);
        })
        .catch(() => {
          addDebugLog("좌표 복사 실패");
        });
    }
  };

  // ✅ Google Maps 링크 열기
  const openInMaps = () => {
    if (location) {
      const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
      window.open(mapsUrl, "_blank");
      addDebugLog("Google Maps에서 열기");
    }
  };

  // 3가지 타입 유령 처리 함수
  const getProcessedGhost = (ghost, index) => {
    if (!supported) return ghost;

    // 기존 orientation-fixed 로직 (그대로 유지)
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

    // ✅ 새로운 타입: location-direction 처리 (위치 + 방향 조건)
    if (ghost.type === "location-direction" && location && compass) {
      // GPS 거리 조건 확인
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ghost.targetLat,
        ghost.targetLon
      );

      const locationInRange = distance <= ghost.locationTolerance;

      // 나침반 방향 조건 확인
      const compassDiff = Math.min(
        Math.abs(compass.heading - ghost.targetCompass),
        360 - Math.abs(compass.heading - ghost.targetCompass)
      );
      const directionInRange = compassDiff <= ghost.compassTolerance;

      addDebugLog(
        `위치+방향 유령: 거리 ${distance.toFixed(1)}m/${
          ghost.locationTolerance
        }m, 방향 ${compass.heading.toFixed(0)}°/${
          ghost.targetCompass
        }° (차이: ${compassDiff.toFixed(0)}°)`
      );

      // ✅ 두 조건 모두 만족해야 보임
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

      // 두 조건 모두 만족하면 화면에 표시
      return {
        ...ghost,
        pos: { x: 50, y: 50 }, // 화면 중앙
        size: ghost.size * 2.0, // 크게 표시
        distance: distance.toFixed(1),
        opacity: 0.95,
        currentDistance: distance,
        currentCompass: compass.heading,
        compassDiff: compassDiff,
        locationInRange: locationInRange,
        directionInRange: directionInRange,
      };
    }

    // 기존 GPS 유령 로직 (그대로 유지)
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

    // always-visible 로직 (그대로 유지)
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
        addDebugLog(
          `GPS 위치 확보: ${location.latitude.toFixed(
            6
          )}, ${location.longitude.toFixed(6)}`
        );
        resetGame(location);
        addDebugLog("GPS 기반 게임 시작!");
      } else if (!location && ghosts.length === 0) {
        addDebugLog("GPS 없이 기본 게임 시작");
        resetGame();
      }
    }
  }, [isActive, location]);

  // GPS 위치 변경 로그
  useEffect(() => {
    if (location) {
      addDebugLog(
        `GPS 업데이트: ${location.latitude.toFixed(
          6
        )}, ${location.longitude.toFixed(6)} (정확도: ${location.accuracy}m)`
      );
    }
  }, [location]);

  // 유령 생성 로그
  useEffect(() => {
    if (ghosts.length > 0) {
      const gpsGhosts = ghosts.filter((g) => g.type === "gps-fixed");
      const orientationGhosts = ghosts.filter(
        (g) => g.type === "orientation-fixed"
      );
      const visibleGhosts = ghosts.filter((g) => g.type === "always-visible");

      addDebugLog(
        `유령 생성 완료: GPS ${gpsGhosts.length}마리, 회전 ${orientationGhosts.length}마리, 일반 ${visibleGhosts.length}마리`
      );
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
            <div key={`ghost-wrapper-${i}`} style={{ position: "relative" }}>
              <Ghost
                gh={processedGhost}
                idx={i}
                onClick={() => {
                  addDebugLog(`GPS 유령 클릭됨!`);
                  catchGhost(i);
                }}
              />
              {/* 거리 표시 */}
              <div
                style={{
                  position: "absolute",
                  left: `${processedGhost.pos.x}%`,
                  top: `${processedGhost.pos.y - 8}%`,
                  transform: "translate(-50%, -100%)",
                  background: "rgba(255,215,0,0.9)",
                  color: "black",
                  padding: "4px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  zIndex: 25 + i,
                  pointerEvents: "none",
                  border: "1px solid #FFD700",
                }}
              >
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

      <ScorePanel
        left={ghosts.length}
        score={score}
        total={totalCaught}
        ghosts={ghosts}
      />

      {/* ✅ 현재 좌표 표시 패널 */}
      {showCoordinates && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            right: 10,
            background: "rgba(0,0,0,0.9)",
            color: "white",
            borderRadius: "15px",
            zIndex: 95,
            border: "3px solid #FFD700",
            boxShadow: "0 0 20px rgba(255, 215, 0, 0.3)",
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              padding: "15px",
              borderBottom: "2px solid #FFD700",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            onClick={() => setShowCoordinates(!showCoordinates)}
          >
            <div
              style={{ fontSize: "16px", fontWeight: "bold", color: "#FFD700" }}
            >
              📍 현재 위치 정보
            </div>
            <div style={{ fontSize: "12px", color: "#ccc" }}>탭해서 접기</div>
          </div>

          {/* 좌표 상세 정보 */}
          <div style={{ padding: "15px" }}>
            {location ? (
              <div>
                {/* 메인 좌표 표시 */}
                <div
                  style={{
                    background: "rgba(255, 215, 0, 0.1)",
                    padding: "15px",
                    borderRadius: "10px",
                    marginBottom: "15px",
                    border: "1px solid #FFD700",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                      marginBottom: "10px",
                      color: "#FFD700",
                    }}
                  >
                    🌍 GPS 좌표
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontFamily: "monospace",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ color: "#4CAF50" }}>위도:</span>{" "}
                    {location.latitude.toFixed(8)}
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontFamily: "monospace",
                      marginBottom: "10px",
                    }}
                  >
                    <span style={{ color: "#2196F3" }}>경도:</span>{" "}
                    {location.longitude.toFixed(8)}
                  </div>

                  {/* 액션 버튼들 */}
                  <div
                    style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
                  >
                    <button
                      onClick={copyCoordinates}
                      style={{
                        flex: 1,
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        padding: "10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      📋 좌표 복사
                    </button>
                    <button
                      onClick={openInMaps}
                      style={{
                        flex: 1,
                        background: "#2196F3",
                        color: "white",
                        border: "none",
                        padding: "10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      🗺️ 지도에서 보기
                    </button>
                  </div>
                </div>

                {/* 추가 정보 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(76, 175, 80, 0.1)",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #4CAF50",
                    }}
                  >
                    <div
                      style={{
                        color: "#4CAF50",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      🎯 정확도
                    </div>
                    <div style={{ fontSize: "14px" }}>
                      ±{location.accuracy?.toFixed(0)}m
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(255, 152, 0, 0.1)",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #FF9800",
                    }}
                  >
                    <div
                      style={{
                        color: "#FF9800",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      ⏰ 업데이트
                    </div>
                    <div style={{ fontSize: "14px" }}>
                      {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* GPS 유령과의 거리 정보 */}
                {ghosts.filter((g) => g.type === "gps-fixed").length > 0 && (
                  <div
                    style={{
                      marginTop: "15px",
                      background: "rgba(33, 150, 243, 0.1)",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #2196F3",
                    }}
                  >
                    <div
                      style={{
                        color: "#2196F3",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      👻 GPS 유령과의 거리
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
                        return (
                          <div
                            key={i}
                            style={{ margin: "4px 0", fontSize: "12px" }}
                          >
                            📍 유령 {i + 1}:{" "}
                            <span
                              style={{
                                color: distance <= 6 ? "#4CAF50" : "#FF9800",
                              }}
                            >
                              {distance.toFixed(1)}m
                            </span>
                            {distance <= 6 && (
                              <span style={{ color: "#4CAF50" }}> ✅ 보임</span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#FF9800",
                }}
              >
                <div style={{ fontSize: "16px", marginBottom: "10px" }}>
                  📍 GPS 위치 확인 중...
                </div>
                <div style={{ fontSize: "12px", color: "#ccc" }}>
                  위치 권한을 허용해주세요
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 좌표 패널 토글 버튼 (접었을 때) */}
      {!showCoordinates && (
        <button
          onClick={() => setShowCoordinates(true)}
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            background: "#FFD700",
            color: "black",
            border: "none",
            padding: "12px",
            borderRadius: "50%",
            fontSize: "16px",
            zIndex: 95,
            fontWeight: "bold",
          }}
        >
          📍
        </button>
      )}

      {/* 유령 정보 상세 패널 (기존) */}
      {showGhostInfo && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(0,0,0,0.9)",
            color: "white",
            borderRadius: "10px",
            zIndex: 90,
            width: "300px",
            border: "2px solid #FF6B6B",
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              padding: "12px",
              borderBottom: "1px solid #555",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            onClick={() => setShowGhostInfo(!showGhostInfo)}
          >
            <div
              style={{ fontSize: "14px", fontWeight: "bold", color: "#FF6B6B" }}
            >
              👻 유령 정보 패널
            </div>
            <div style={{ fontSize: "12px", color: "#ccc" }}>탭해서 접기</div>
          </div>

          {/* 각 유령별 상세 정보 */}
          <div style={{ padding: "12px", fontSize: "12px" }}>
            {ghosts.map((gh, i) => {
              const processedGhost = getProcessedGhost(gh, i);

              return (
                <div
                  key={i}
                  style={{
                    marginBottom: "15px",
                    padding: "10px",
                    backgroundColor:
                      gh.type === "gps-fixed"
                        ? "rgba(33, 150, 243, 0.2)"
                        : gh.type === "orientation-fixed"
                        ? "rgba(255, 107, 107, 0.2)"
                        : "rgba(76, 175, 80, 0.2)",
                    borderRadius: "8px",
                    border: `1px solid ${
                      gh.type === "gps-fixed"
                        ? "#2196F3"
                        : gh.type === "orientation-fixed"
                        ? "#FF6B6B"
                        : "#4CAF50"
                    }`,
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "8px",
                      color:
                        gh.type === "gps-fixed"
                          ? "#2196F3"
                          : gh.type === "orientation-fixed"
                          ? "#FF6B6B"
                          : "#4CAF50",
                    }}
                  >
                    {gh.type === "gps-fixed"
                      ? "📍"
                      : gh.type === "orientation-fixed"
                      ? "🎯"
                      : "👻"}
                    {gh.title || `유령 ${i + 1}`}
                  </div>

                  {/* GPS 유령 정보 */}
                  {gh.type === "gps-fixed" && (
                    <div>
                      <div>
                        📍 GPS 좌표: {gh.gpsLat.toFixed(6)},{" "}
                        {gh.gpsLon.toFixed(6)}
                      </div>
                      <div>
                        📏 현재 거리:{" "}
                        {processedGhost.currentDistance?.toFixed(1)}m
                      </div>
                      <div>🧭 방향: {processedGhost.bearing?.toFixed(0)}°</div>
                      <div>👁️ 최대 가시거리: {gh.maxVisibleDistance}m</div>
                      <div>
                        🎯 초기 배치: {gh.initialDistance?.toFixed(1)}m,{" "}
                        {gh.initialAngle?.toFixed(0)}°
                      </div>
                      <div
                        style={{
                          color:
                            processedGhost.currentDistance <=
                            gh.maxVisibleDistance
                              ? "#4CAF50"
                              : "#FF9800",
                        }}
                      >
                        📺 상태:{" "}
                        {processedGhost.currentDistance <= gh.maxVisibleDistance
                          ? "화면에 보임"
                          : "범위 밖"}
                      </div>
                    </div>
                  )}

                  {/* 회전 감지 유령 정보 */}
                  {gh.type === "orientation-fixed" && (
                    <div>
                      <div>🎯 목표 α각도: {gh.targetAlpha.toFixed(0)}°</div>
                      <div>📐 목표 β각도: {gh.targetBeta.toFixed(0)}°</div>
                      <div>⚖️ 허용 오차: ±{gh.tolerance}°</div>
                      <div>
                        🧭 현재 α각도: {processedGhost.currentAlpha?.toFixed(0)}
                        °
                      </div>
                      <div>
                        📱 현재 β각도: {processedGhost.currentBeta?.toFixed(0)}°
                      </div>
                      <div>
                        📏 α 차이: {processedGhost.alphaDiff?.toFixed(0)}°
                      </div>
                      <div>
                        📏 β 차이: {processedGhost.betaDiff?.toFixed(0)}°
                      </div>
                      <div>
                        📍 화면 위치: ({gh.pos?.x?.toFixed(1)}%,{" "}
                        {gh.pos?.y?.toFixed(1)}%)
                      </div>
                      <div
                        style={{
                          color:
                            processedGhost.pos?.x > 0 ? "#4CAF50" : "#FF9800",
                        }}
                      >
                        📺 상태:{" "}
                        {processedGhost.pos?.x > 0
                          ? "화면에 보임"
                          : "각도 맞지 않음"}
                      </div>
                    </div>
                  )}

                  {/* 일반 유령 정보 */}
                  {gh.type === "always-visible" && (
                    <div>
                      <div>
                        📍 현재 위치: ({gh.pos?.x?.toFixed(1)}%,{" "}
                        {gh.pos?.y?.toFixed(1)}%)
                      </div>
                      <div>🔄 회전각: {gh.rotation?.toFixed(0)}°</div>
                      <div>📏 크기: {gh.size}px</div>
                      <div>⚡ 이동 속도: {gh.speed}ms</div>
                      <div style={{ color: "#4CAF50" }}>
                        📺 상태: 항상 보임 (움직임)
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 유령 정보 토글 버튼 (접었을 때) */}
      {!showGhostInfo && (
        <button
          onClick={() => setShowGhostInfo(true)}
          style={{
            position: "absolute",
            top: 20,
            right: 80,
            background: "#FF6B6B",
            color: "white",
            border: "none",
            padding: "10px",
            borderRadius: "8px",
            fontSize: "12px",
            zIndex: 90,
          }}
        >
          👻 유령 정보 보기
        </button>
      )}

      {/* 디버그 패널 (기존) */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          background: "rgba(0,0,0,0.9)",
          color: "white",
          borderRadius: "10px",
          zIndex: 100,
          width: "250px",
          border: "2px solid #4CAF50",
        }}
      >
        <div
          style={{
            padding: "12px",
            borderBottom: showDebug ? "1px solid #555" : "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          onClick={() => setShowDebug(!showDebug)}
        >
          <div
            style={{ fontSize: "14px", fontWeight: "bold", color: "#4CAF50" }}
          >
            🔍 디버그 정보 {showDebug ? "▼" : "▶"}
          </div>
          <div style={{ fontSize: "12px", color: "#ccc" }}>
            탭해서 {showDebug ? "접기" : "펼치기"}
          </div>
        </div>

        {showDebug && (
          <div style={{ padding: "12px", fontSize: "12px" }}>
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  color: "#FFD700",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                📊 현재 상태
              </div>
              <div>
                🧭 방향: α={Math.round(orientation.alpha)}° β=
                {Math.round(orientation.beta)}°
              </div>
              <div>
                📍 GPS:{" "}
                {location
                  ? `${location.latitude.toFixed(
                      6
                    )}, ${location.longitude.toFixed(6)}`
                  : "위치 확인 중..."}
              </div>
              <div>🎯 정확도: {location?.accuracy?.toFixed(0)}m</div>
              <div>👻 전체 유령: {ghosts.length}마리</div>
            </div>

            <div>
              <div
                style={{
                  color: "#FFD700",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                📝 최근 로그 (최근 3개)
              </div>
              <div
                style={{
                  maxHeight: "100px",
                  overflowY: "auto",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                  padding: "5px",
                }}
              >
                {debugLogs.slice(-3).map((log, i) => (
                  <div key={i} style={{ margin: "2px 0", fontSize: "10px" }}>
                    <span style={{ color: "#888" }}>[{log.time}]</span>{" "}
                    {log.message}
                  </div>
                ))}
                {debugLogs.length === 0 && (
                  <div style={{ color: "#888", fontSize: "10px" }}>
                    로그 없음
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

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
            bottom: 200,
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
