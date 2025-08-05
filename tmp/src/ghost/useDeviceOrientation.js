// hooks/useDeviceOrientation.js
import { useState, useEffect } from 'react';

export default function useDeviceOrientation() {
  const [orientation, setOrientation] = useState({ 
    alpha: 0,  // z축 회전 (나침반)
    beta: 0,   // x축 회전 (앞뒤 기울기)  
    gamma: 0   // y축 회전 (좌우 기울기)
  });
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // 권한 요청 (iOS 13+)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            setSupported(true);
          }
        });
    } else if (window.DeviceOrientationEvent) {
      setSupported(true);
    }

    function handleOrientation(event) {
      setOrientation({
        alpha: event.alpha || 0,   // 0-360도
        beta: event.beta || 0,     // -180~180도
        gamma: event.gamma || 0    // -90~90도
      });
    }

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  return { orientation, supported };
}
