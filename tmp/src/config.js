export const CONFIG = {
  markerImageUrl: "/image.jpg",
  mapboxToken: "pk.eyJ1IjoiamVvbmd5ZXNlb25nIiwiYSI6ImNtZHJldDNkODBmMW4yaXNhOGE1eWg4ODcifQ.LNsrvvxhCIJ6Lvwc9c0tVg",
  targetLat: 35.18376162,
  targetLng: 126.82287685
};

export const MARKER_CENTER = { lng: CONFIG.targetLng, lat: CONFIG.targetLat };

// 기준 좌표 중심으로 10개 마커 랜덤 배치 (약 100~200m 반경)
export const EXTRA_MARKERS = [
  {
    lng: MARKER_CENTER.lng + 0.0012,
    lat: MARKER_CENTER.lat + 0.001,
    title: "커피마을",
    description: "향긋한 커피가 있는 곳",
  },
  {
    lng: MARKER_CENTER.lng - 0.0011,
    lat: MARKER_CENTER.lat - 0.0007,
    title: "헬스존",
    description: "건강을 위한 헬스장",
  },
  {
    lng: MARKER_CENTER.lng + 0.0008,
    lat: MARKER_CENTER.lat - 0.0012,
    title: "피크닉장",
    description: "야외 피크닉 명소",
  },
  {
    lng: MARKER_CENTER.lng - 0.0009,
    lat: MARKER_CENTER.lat + 0.0005,
    title: "놀이터",
    description: "아이들이 뛰노는 놀이터",
  },
  {
    lng: MARKER_CENTER.lng + 0.0015,
    lat: MARKER_CENTER.lat + 0.0006,
    title: "전망대",
    description: "넓은 경치를 볼 수 있는 전망대",
  },
  {
    lng: MARKER_CENTER.lng - 0.0013,
    lat: MARKER_CENTER.lat + 0.0014,
    title: "사진스팟",
    description: "인생샷 명소",
  },
  {
    lng: MARKER_CENTER.lng + 0.0006,
    lat: MARKER_CENTER.lat - 0.0008,
    title: "문화의 거리",
    description: "지역 문화 예술 공간",
  },
  {
    lng: MARKER_CENTER.lng - 0.0017,
    lat: MARKER_CENTER.lat - 0.0004,
    title: "쉼터",
    description: "잔디와 벤치가 있는 쉼터",
  },
  {
    lng: MARKER_CENTER.lng + 0.0013,
    lat: MARKER_CENTER.lat - 0.0005,
    title: "맛집거리",
    description: "다양한 음식점이 모인 거리",
  },
  {
    lng: MARKER_CENTER.lng - 0.0004,
    lat: MARKER_CENTER.lat + 0.0017,
    title: "산책길",
    description: "산책과 운동 겸하기 좋은 길",
  },
];