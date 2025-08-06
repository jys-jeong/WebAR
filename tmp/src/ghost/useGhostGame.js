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
      type: "gps-fixed",
      gpsLat: baseLocation.latitude, // ✅ 정확히 같은 위도
      gpsLon: baseLocation.longitude, // ✅ 정확히 같은 경도
      maxVisibleDistance: 100, // ✅ 100m 반경 (넉넉하게)
      speed: 0,
      isFixed: true,
      title: "내 위치 GPS 유령",
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
