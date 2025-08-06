// hooks/useCompass.js (기존 파일 수정)
import { useState, useEffect } from 'react';

export default function useCompass() {
  const [compass, setCompass] = useState(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof DeviceOrientationEvent !== 'undefined') {
      setSupported(true);

      const handleOrientation = (event) => {
        // 나침반 방향 계산 (0도 = 북쪽)
        let heading = event.alpha;
        
        if (heading !== null) {
          // 안드로이드와 iOS 호환성 처리
          if (event.webkitCompassHeading) {
            heading = event.webkitCompassHeading; // iOS
          } else {
            heading = 360 - heading; // 안드로이드
          }
          
          setCompass({
            heading: heading,
            accuracy: event.alpha !== null ? 'high' : 'low'
          });
        }
      };

      window.addEventListener('deviceorientationabsolute', handleOrientation);
      window.addEventListener('deviceorientation', handleOrientation);

      return () => {
        window.removeEventListener('deviceorientationabsolute', handleOrientation);
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    }
  }, []);

  return { compass, supported };
}
