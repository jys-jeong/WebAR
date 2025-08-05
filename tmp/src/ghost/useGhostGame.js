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

  // ✅ 두 타입 유령 생성
  const resetGame = useCallback(() => {
    const fixedTargetAlpha = Math.random() * 360; // 0~360도
    const fixedTargetBeta = (Math.random() - 0.5) * 60; // -30~30도

    const newGhosts = [
      {
        ...createRandomGhost(),
        type: "spatial-fixed",
        // ✅ 가상 공간에서의 절대 위치 (극좌표)
        worldAlpha: 90, // 동쪽 방향
        worldBeta: 0, // 수평
        worldDistance: 2.0, // 2미터 거리
        viewAngle: 30, // ±30도 시야각에서 보임
      },
      // 🎯 Type A: 특정 각도에서만 보이는 고정 유령
      {
        ...createRandomGhost(),
        type: "orientation-fixed",
        targetAlpha: fixedTargetAlpha,
        targetBeta: fixedTargetBeta,
        tolerance: 15, // ±15도 허용 오차
      },
      // 👻 Type B: 항상 보이는 움직이는 유령
      {
        ...createRandomGhost(),
        type: "always-visible",
      },
    ];

    setGhosts(newGhosts);
    setScore(0);
    setTotalCaught(0);

    console.log(
      `🎯 목표 각도: α=${fixedTargetAlpha.toFixed(
        0
      )}°, β=${fixedTargetBeta.toFixed(0)}°`
    );
  }, []);

  // 나머지 함수들은 그대로 유지
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
