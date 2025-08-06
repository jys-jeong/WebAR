// hooks/useGhostGame.js
import { useState, useCallback, useEffect } from "react";
import { createRandomGhost } from "./ghostUtils";

const movementPatterns = [
  "random-jump",
  "smooth-slide",
  "circular",
  "zigzag",
  "bounce",
  "pause",
  "spiral",
  "shake",
];

export default function useGhostGame() {
  const [ghosts, setGhosts] = useState([]);
  const [score, setScore] = useState(0);
  const [totalCaught, setTotalCaught] = useState(0);

  // ✅ 각 유형별로 정확히 1마리씩만 생성
  const resetGame = useCallback((userLocation) => {
    let newGhosts = [];

    // ✅ 1. orientation-fixed 유령 - 1마리
    newGhosts.push({
      ...createRandomGhost(),
      type: "orientation-fixed",
      targetAlpha: Math.random() * 360,
      targetBeta: (Math.random() - 0.5) * 60,
      tolerance: 30,
      title: "🎯 회전감지 유령",
    });

    // ✅ 2. always-visible 유령 - 1마리
    newGhosts.push({
      ...createRandomGhost(),
      type: "always-visible",
      title: "👻 일반 유령",
    });

    // ✅ 3. location-direction 유령 - 1마리 (GPS 위치가 있을 때만)
    if (userLocation) {
      newGhosts.push({
        ...createRandomGhost(),
        type: "location-direction",
        targetLat: 35.20517490 + 0.000045, // 북쪽 5m
        targetLon: 126.81175610 + 0.000045, // 동쪽 5m
        locationTolerance: 10, // 10m 이내
        targetCompass: 45, // 북동쪽 45도
        compassTolerance: 15, // ±15도 허용
        title: "🧭 위치+방향 유령",
      });
    }

    // ✅ 4. gps-fixed 유령 - 1마리 (GPS 위치가 있을 때만)
    if (userLocation) {
      newGhosts.push({
        ...createRandomGhost(),
        type: "gps-fixed",
        gpsLat: 35.20517490.latitude, // 현재 위치와 동일
        gpsLon: 126.81175610.longitude, // 현재 위치와 동일
        maxVisibleDistance: 100, // 100m 반경
        title: "🌍 GPS 유령",
      });
    }

    setGhosts(newGhosts);
    setScore(0);
    setTotalCaught(0);

    // ✅ 생성된 유령 수 확인 로그
    console.log(`🎮 게임 시작: 총 ${newGhosts.length}마리 유령 생성`);
    console.log(`- 회전감지: 1마리`);
    console.log(`- 일반: 1마리`);
    console.log(`- 위치+방향: ${userLocation ? 1 : 0}마리`);
    console.log(`- GPS: ${userLocation ? 1 : 0}마리`);
  }, []);

  const catchGhost = (index) => {
    setGhosts((prev) =>
      prev.map((gh, i) => (i === index ? { ...gh, anim: true } : gh))
    );

    setScore((prev) => prev + 10);
    setTotalCaught((prev) => prev + 1);

    setTimeout(() => {
      setGhosts((prev) => {
        const filtered = prev.filter((_, i) => i !== index);
        if (filtered.length === 0) {
          setTimeout(() => resetGame(), 1000);
        }
        return filtered;
      });
    }, 500);
  };

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  return {
    ghosts,
    setGhosts,
    score,
    totalCaught,
    resetGame,
    catchGhost,
    movementPatterns,
  };
}
