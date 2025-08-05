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
      // ✅ 강제로 3마리 생성하도록 수정
      const numGpsGhosts = 3; // 랜덤 대신 고정
      console.log("🎯 GPS 유령 생성 개수:", numGpsGhosts);

      for (let i = 0; i < numGpsGhosts; i++) {
        const distance = 60 + i * 20; // 60m, 80m, 100m
        const angle = i * 120; // 0도, 120도, 240도

        const latOffset =
          (distance * Math.cos((angle * Math.PI) / 180)) / 111000;
        const lonOffset =
          (distance * Math.sin((angle * Math.PI) / 180)) /
          (111000 * Math.cos((userLocation.latitude * Math.PI) / 180));

        const ghost = {
          ...createRandomGhost(),
          type: "gps-fixed",
          gpsLat: userLocation.latitude + latOffset,
          gpsLon: userLocation.longitude + lonOffset,
          maxVisibleDistance: 120, // 거리 여유있게
          title: `GPS유령${i + 1}`,
          targetDistance: distance,
        };

        newGhosts.push(ghost);
        console.log(`👻 GPS 유령 ${i + 1} 생성:`, distance + "m", angle + "도");
      }
    }

    // 다른 타입 추가
    newGhosts.push({
      ...createRandomGhost(),
      type: "orientation-fixed",
      targetAlpha: Math.random() * 360,
      targetBeta: (Math.random() - 0.5) * 60,
      tolerance: 30,
    });

    newGhosts.push({
      ...createRandomGhost(),
      type: "always-visible",
    });

    console.log("🎮 전체 유령 배열:", newGhosts);
    console.log("📊 유령 타입별 개수:", {
      gps: newGhosts.filter((g) => g.type === "gps-fixed").length,
      orientation: newGhosts.filter((g) => g.type === "orientation-fixed")
        .length,
      visible: newGhosts.filter((g) => g.type === "always-visible").length,
    });

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
