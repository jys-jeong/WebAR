// hooks/useGhostGame.js
import { useState, useCallback, useEffect } from "react";
import { createRandomGhost } from "./ghostUtils";

const movementPatterns = [
  "random-jump", "smooth-slide", "circular", "zigzag",
  "bounce", "pause", "spiral", "shake",
];

export default function useGhostGame() {
  const [ghosts, setGhosts] = useState([]);
  const [score, setScore] = useState(0);
  const [totalCaught, setTotalCaught] = useState(0);

  // ✅ 각 유형별로 정확히 1마리씩만 생성
  const resetGame = useCallback((userLocation) => {
    let newGhosts = [];

    // 🎯 Type A: orientation-fixed 유령 1마리
    newGhosts.push({
      ...createRandomGhost(),
      type: "orientation-fixed",
      targetAlpha: Math.random() * 360,      // 0~360도
      targetBeta: (Math.random() - 0.5) * 60, // -30~30도
      tolerance: 30,                          // ±30도 허용
      title: "회전감지 유령"
    });

    // 📍 Type B: GPS 기반 유령 1마리 (위치가 있을 때만)
    if (userLocation) {
      const distance = Math.random() * 4 + 1; // 1~5m
      const angle = Math.random() * 360;      // 0~360도
      
      const latOffset = (distance * Math.cos(angle * Math.PI / 180)) / 111000;
      const lonOffset = (distance * Math.sin(angle * Math.PI / 180)) / (111000 * Math.cos(userLocation.latitude * Math.PI / 180));
      
      newGhosts.push({
        ...createRandomGhost(),
        type: "gps-fixed",
        gpsLat: userLocation.latitude + latOffset,
        gpsLon: userLocation.longitude + lonOffset,
        maxVisibleDistance: 6,
        title: "GPS 유령",
        initialDistance: distance,
        initialAngle: angle
      });
    }

    // 👻 Type C: always-visible 유령 1마리
    newGhosts.push({
      ...createRandomGhost(),
      type: "always-visible",
      title: "일반 유령"
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

    setScore(prev => prev + 10);
    setTotalCaught(prev => prev + 1);

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

  useEffect(() => { resetGame(); }, [resetGame]);

  return {
    ghosts, setGhosts, score, totalCaught,
    resetGame, catchGhost, movementPatterns,
  };
}
