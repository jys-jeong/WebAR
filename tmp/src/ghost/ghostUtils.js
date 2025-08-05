// 초기 유령 난수 생성과 공통 상수
export const IMAGE_OPTIONS = [
  './donut.png', './cookie.png', './rollcake.png',
  './pinkmacarong.png', './malcha.png', './pineappletart.png'
];

export const randomBetween = (min, max) =>
  Math.random() * (max - min) + min;

export const createRandomGhost = () => ({
  src: IMAGE_OPTIONS[Math.floor(Math.random() * IMAGE_OPTIONS.length)],
  pos: { x: randomBetween(0, 100), y: randomBetween(0, 100) },
  size: randomBetween(100, 200),
  rotation: 0,
  hue: randomBetween(0, 360),
  speed: randomBetween(150, 800),   // 🔹 0.15‒0.8 초마다 이동
  anim: false
});