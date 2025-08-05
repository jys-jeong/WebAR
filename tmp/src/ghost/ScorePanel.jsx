import React from 'react';

export default function ScorePanel({ left, score, total }) {
  return (
    <div style={{
      position:'absolute', top:20, left:20, right:80,
      background:'rgba(0,0,0,.9)', color:'#fff',
      padding:15, borderRadius:12, border:'2px solid #FF6B6B',
      zIndex:50, fontSize:14
    }}>
      <h3 style={{margin:0, color:'#FF6B6B'}}>
        👻 유령 사냥 AR ({left}마리 남음)
      </h3>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
        <span>🎯 스코어: <strong>{score}</strong>점</span>
        <span>👻 총 처치: <strong>{total}</strong>마리</span>
      </div>
    </div>
  );
}
