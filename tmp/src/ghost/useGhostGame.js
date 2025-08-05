import { useState, useCallback, useEffect } from "react";
import { createRandomGhost } from "./ghostUtils";

const movementPatterns = [
  "random-jump","smooth-slide","circular","zigzag",
  "bounce","pause","spiral","shake"
];

export default function useGhostGame() {
  const [ghosts,       setGhosts] = useState([]);
  const [score,        setScore]  = useState(0);
  const [totalCaught,  setCaught] = useState(0);

  /* 새 라운드 생성 ─ orientation-fixed 1마리 + always-visible 1마리 */
  const resetGame = useCallback(() => {
    const g1 = {
      ...createRandomGhost(),
      type: "orientation-fixed",
      targetAlpha: Math.random()*360,            // 목표 방향
      targetBeta:  (Math.random()-0.5)*60,       // 목표 기울기 (-30~30°)
      tolerance: 15                              // 허용 오차 ±15°
    };
    const g2 = { ...createRandomGhost(), type:"always-visible" };
    setGhosts([g1, g2]);
    setScore(0);
    setCaught(0);
    console.log(
      `🎯 목표 α=${g1.targetAlpha.toFixed(0)}°, β=${g1.targetBeta.toFixed(0)}°`
    );
  }, []);

  /* 잡기 */
  const catchGhost = (idx) => {
    setGhosts(g => g.map((gh,i)=> i===idx?{...gh,anim:true}:gh));
    setScore(s=>s+10);
    setCaught(c=>c+1);

    setTimeout(() => {
      setGhosts(g => {
        const remain = g.filter((_,i)=>i!==idx);
        if (remain.length === 0) setTimeout(resetGame, 1_000);
        return remain;
      });
    }, 500);
  };

  useEffect(() => { resetGame(); }, [resetGame]);

  return { ghosts, setGhosts, score, totalCaught,
           resetGame, catchGhost, movementPatterns };
}
