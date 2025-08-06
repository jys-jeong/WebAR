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

    if (userLocation) {
      const numGpsGhosts = 3; // 3마리 고정

      for (let i = 0; i < numGpsGhosts; i++) {
        // ✅ 1-5m 초근거리로 수정
        const distance = Math.random() * 4 + 1; // 1~5m 랜덤
        const angle = Math.random() * 360; // 완전 랜덤 방향

        const latOffset =
          (distance * Math.cos((angle * Math.PI) / 180)) / 111000;
        const lonOffset =
          (distance * Math.sin((angle * Math.PI) / 180)) /
          (111000 * Math.cos((userLocation.latitude * Math.PI) / 180));

        newGhosts.push({
          ...createRandomGhost(),
          type: "gps-fixed",
          gpsLat: userLocation.latitude + latOffset,
          gpsLon: userLocation.longitude + lonOffset,
          maxVisibleDistance: 6, // 6m 이내에서만 보임
          title: `초근거리 유령 ${i + 1}`,
          targetDistance: distance,
        });

        console.log(
          `👻 GPS 유령 ${i + 1}: ${distance.toFixed(1)}m 거리에 배치`
        );
      }
    }

    // 다른 타입들 추가
    newGhosts.push(
      {
        ...createRandomGhost(),
        type: "orientation-fixed",
        targetAlpha: Math.random() * 360,
        targetBeta: (Math.random() - 0.5) * 60,
        tolerance: 30,
      },
      {
        ...createRandomGhost(),
        type: "always-visible",
      }
    );

    setGhosts(newGhosts);
    setScore(0);
    setTotalCaught(0);

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
