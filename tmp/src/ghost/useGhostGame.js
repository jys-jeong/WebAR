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

  // ✅ 현재 위치 기반 유령 생성
  const resetGame = useCallback((userLocation) => {
    let newGhosts = [];

    // 🎯 orientation-fixed 유령 - 1마리
    newGhosts.push({
      ...createRandomGhost(),
      type: "orientation-fixed",
      targetAlpha: Math.random() * 360,
      targetBeta: (Math.random() - 0.5) * 60,
      tolerance: 30,
      title: "🎯 회전감지 유령",
    });

    // ✅ GPS 유령 - 고정된 특정 좌표에 배치
    newGhosts.push({
      ...createRandomGhost(),
      type: "gps-fixed",
      gpsLat: 35.2051749, // ✅ 지정된 위도
      gpsLon: 126.8117561, // ✅ 지정된 경도
      maxVisibleDistance: 100, // 100m 이내에서 보임
      speed: 0,
      isFixed: true,
      title: "🌍 특정 위치 유령",
    });

    // 👻 always-visible 유령 - 1마리
    newGhosts.push({
      ...createRandomGhost(),
      type: "always-visible",
      title: "👻 일반 유령",
    });

    setGhosts(newGhosts);
    setScore(0);
    setTotalCaught(0);

    console.log(`🎮 게임 시작: 총 ${newGhosts.length}마리 유령 생성`);
    console.log(`📍 GPS 유령 위치: 35.20517490, 126.81175610`);
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
