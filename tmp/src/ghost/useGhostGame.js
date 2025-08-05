import { useState, useCallback, useEffect } from "react";
import { createRandomGhost, randomBetween } from "./ghostUtils";

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

  // 새 게임 초기화
  const resetGame = useCallback(() => {
    const numImages = Math.floor(Math.random() * 6) + 1; // 1-6개
    const newGhosts = Array.from({ length: numImages }, createRandomGhost);
    setGhosts(newGhosts);
    setScore(0);
    setTotalCaught(0);
  }, []);

  // 유령 잡기
  const catchGhost = (index) => {
    // 애니메이션 활성화
    setGhosts((prev) =>
      prev.map((gh, i) => (i === index ? { ...gh, anim: true } : gh))
    );

    // 스코어 증가
    setScore(prev => prev + 10);
    setTotalCaught(prev => prev + 1);

    // 0.5초 후 제거
    setTimeout(() => {
      setGhosts((prev) => {
        const filtered = prev.filter((_, i) => i !== index);
        // 모든 유령이 사라지면 새 라운드
        if (filtered.length === 0) {
          setTimeout(() => resetGame(), 1000);
        }
        return filtered;
      });
    }, 500);
  };

  // 컴포넌트 마운트 시 게임 시작
  useEffect(() => { resetGame(); }, [resetGame]);

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
