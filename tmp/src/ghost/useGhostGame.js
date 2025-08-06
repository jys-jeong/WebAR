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

    // 🎯 orientation-fixed 유령 1마리 (기존 그대로)
    newGhosts.push({
      ...createRandomGhost(),
      type: "orientation-fixed",
      targetAlpha: Math.random() * 360,
      targetBeta: (Math.random() - 0.5) * 60,
      tolerance: 30,
      title: "회전감지 유령",
    });

    // ✅ GPS 유령 - 올바른 좌표 계산으로 수정
    if (userLocation) {
      const distance = Math.random() * 2 + 1; // 1~3m로 더 가깝게
      const angle = Math.random() * 360;

      // ✅ 정확한 GPS 오프셋 계산 (미터 단위)
      // 1도 = 약 111,000m이므로 미터를 111,000으로 나눠야 함
      const latOffset = (distance * Math.cos((angle * Math.PI) / 180)) / 111000; // 북-남 방향
      const lonOffset =
        (distance * Math.sin((angle * Math.PI) / 180)) /
        (111000 * Math.cos((userLocation.latitude * Math.PI) / 180)); // 동-서 방향 (위도보정)

      newGhosts.push({
        ...createRandomGhost(),
        type: "gps-fixed",
        gpsLat: userLocation.latitude + 0.000027, // 약 3m 북쪽
        gpsLon: userLocation.longitude + 0.000027, // 약 3m 동쪽
        maxVisibleDistance: 5, // 5m 반경에서 보임
        title: "GPS 유령",
        initialDistance: distance,
        initialAngle: angle,
      });

      console.log(
        `📍 GPS 유령 배치: ${distance.toFixed(1)}m 거리, ${angle.toFixed(
          0
        )}도 방향`
      );
      console.log(
        `📍 사용자 위치: ${userLocation.latitude}, ${userLocation.longitude}`
      );
      console.log(
        `📍 유령 위치: ${userLocation.latitude + latOffset}, ${
          userLocation.longitude + lonOffset
        }`
      );
    }

    // 👻 일반 유령 1마리 (기존 그대로)
    newGhosts.push({
      ...createRandomGhost(),
      type: "always-visible",
      title: "일반 유령",
    });

    setGhosts(newGhosts);
    setScore(0);
    setTotalCaught(0);

    console.log(`🎮 게임 시작: 총 ${newGhosts.length}마리 유령 생성`);
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
