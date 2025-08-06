import React from 'react';

export default function Ghost({ gh, idx, onClick }) {

  const handle = e => {
    e.stopPropagation();
    navigator.vibrate?.([100,50,100]);
    onClick(idx, e);
  };

  return (
    <img
      src={gh.src}
      alt={`ghost-${idx}`}
      draggable={false}
      onClick={handle}
      style={{
        position:'absolute',
        left:`${gh.pos.x}%`,
        top:`${gh.pos.y}%`,
        width:`${gh.size}px`,
        height:`${gh.size}px`,
        transform:`translate(-50%,-50%) rotate(${gh.rotation}deg)`,
        filter: gh.anim
          ? `drop-shadow(0 12px 24px rgba(255,0,0,.8)) brightness(1.5) saturate(150%)`
          : `drop-shadow(0 6px 12px rgba(0,0,0,.4))`,
        cursor:'crosshair',
        transition:'all 0.4s ease-in-out',
        animation: gh.anim ? 'ghostCatch 0.5s ease' : 'none',
        zIndex: 10 + idx
      }}
    />
  );
}
