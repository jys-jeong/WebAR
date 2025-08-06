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
  // hooks/useGhostGame.js의 resetGame 함수 수정
  const resetGame = useCallback((userLocation) => {
    let newGhosts = [];

    // 🎯 회전감지 유령 1마리
    newGhosts.push({
      ...createRandomGhost(),
      type: "orientation-fixed",
      targetAlpha: Math.random() * 360,
      targetBeta: (Math.random() - 0.5) * 60,
      tolerance: 30,
      title: "회전감지 유령",
    });

    // ✅ GPS 유령 - 위치가 없어도 테스트용으로 생성
    const testLocation = userLocation || {
      latitude: 37.5665, // 서울시청 좌표
      longitude: 126.978,
    };

    const distance = 3; // 3m 거리로 고정
    const angle = 45; // 45도 방향으로 고정

    const latOffset = (distance * Math.cos((angle * Math.PI) / 180)) / 111000;
    const lonOffset =
      (distance * Math.sin((angle * Math.PI) / 180)) /
      (111000 * Math.cos((testLocation.latitude * Math.PI) / 180));

    newGhosts.push({
      ...createRandomGhost(),
      type: "gps-fixed",
      gpsLat: testLocation.latitude + latOffset,
      gpsLon: testLocation.longitude + lonOffset,
      maxVisibleDistance: 50, // 50m로 넉넉하게 설정
      title: "GPS 유령",
      initialDistance: distance,
      initialAngle: angle,
    });

    // 👻 일반 유령 1마리
    newGhosts.push({
      ...createRandomGhost(),
      type: "always-visible",
      title: "일반 유령",
    });

    setGhosts(newGhosts);
    setScore(0);
    setTotalCaught(0);

    console.log(`🎮 게임 시작: 총 ${newGhosts.length}마리 유령 생성`);
    console.log("GPS 유령 배치:", { distance, angle, maxVisibleDistance: 50 });
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
