import { useState, useEffect } from 'react';

export default function useDeviceOrientation() {
  const [orientation, setOrientation] = useState({ alpha:0, beta:0, gamma:0 });
  const [supported,  setSupported]   = useState(false);

  useEffect(() => {
    // iOS 13+ 권한
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(state => { if (state === 'granted') setSupported(true); });
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      setSupported(true);
    }

    function handle(e) {
      setOrientation({
        alpha: e.alpha || 0,
        beta:  e.beta  || 0,
        gamma: e.gamma || 0
      });
    }
    window.addEventListener('deviceorientation', handle);
    return () => window.removeEventListener('deviceorientation', handle);
  }, []);

  return { orientation, supported };
}
