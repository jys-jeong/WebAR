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

    // 기존 회전감지 유령
    newGhosts.push({
      ...createRandomGhost(),
      type: "orientation-fixed",
      targetAlpha: Math.random() * 360,
      targetBeta: (Math.random() - 0.5) * 60,
      tolerance: 30,
      title: "회전감지 유령",
    });

    // ✅ GPS 유령 - 현재 위치 바로 그 자리에 배치
    const baseLocation = {
      latitude: 35.20517490, // 서울시청 (GPS 없을 때 기본값)
      longitude: 126.81175610,
    };

    newGhosts.push({
      ...createRandomGhost(),
      type: "location-direction",
      // GPS 조건
      targetLat: baseLocation.latitude + 0.000045,  // 북쪽 5m
      targetLon: baseLocation.longitude + 0.000045, // 동쪽 5m
      locationTolerance: 10, // 10m 이내
      // 방향 조건  
      targetCompass: 45,     // 북동쪽 45도
      compassTolerance: 15,  // ±15도 허용
      title: "위치+방향 유령"
    });

    // 기존 일반 유령
    newGhosts.push({
      ...createRandomGhost(),
      type: "always-visible",
      title: "일반 유령",
    });

    setGhosts(newGhosts);
    setScore(0);
    setTotalCaught(0);

    console.log(
      `🎮 현재 위치에 GPS 유령 생성: ${baseLocation.latitude}, ${baseLocation.longitude}`
    );
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
