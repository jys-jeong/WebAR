// 초기 유령 난수 생성과 공통 상수
export const IMAGE_OPTIONS = [
  './donut.png', './cookie.png', './rollcake.png',
  './pinkmacarong.png', './malcha.png', './pineappletart.png'
];

export const randomBetween = (min, max) =>
  Math.random() * (max - min) + min;

export const createRandomGhost = () => ({
  src: IMAGE_OPTIONS[Math.floor(Math.random() * IMAGE_OPTIONS.length)],
  pos: { x: randomBetween(10, 90), y: randomBetween(10, 90) },
  size: randomBetween(100, 200),
  rotation: 0,
  hue: 0,                          // 원본 색상 유지
  speed: randomBetween(150, 800),  // 0.15‒0.8초 이동 주기
  anim: false
});
