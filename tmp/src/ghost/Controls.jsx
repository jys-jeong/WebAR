import React from 'react';

export default function Controls({
  ghostsLen, addGhost,
  shuffleSpeeds, shufflePositions,
  resetGame
}) {
  return (
    <div style={{
      position:'absolute', bottom:20, left:'50%',
      transform:'translateX(-50%)',
      background:'rgba(0,0,0,.9)', color:'#fff',
      padding:15, borderRadius:12, display:'flex',
      gap:10, flexWrap:'wrap', zIndex:50,
      border:'2px solid #4CAF50'
    }}>
      <button disabled={ghostsLen>=6}
        style={{...btnStyle, opacity:ghostsLen>=6?0.5:1}}
        onClick={addGhost}>👻 추가 ({ghostsLen}/6)</button>
      <button style={{...btnStyle, background:'#E91E63'}}
        onClick={shuffleSpeeds}>⚡ 속도</button>
      <button style={{...btnStyle, background:'#9C27B0'}}
        onClick={shufflePositions}>🌀 위치</button>
      <button style={{...btnStyle, background:'#FF9800'}}
        onClick={resetGame}>🎲 새 게임</button>
    </div>
  );
}

const btnStyle = {
  background:'#4CAF50', color:'#fff', border:'none',
  padding:'10px 15px', borderRadius:8, fontWeight:'bold',
  fontSize:12, cursor:'pointer'
};
