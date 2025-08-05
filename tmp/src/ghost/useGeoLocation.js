import { useState, useEffect } from 'react';

export default function useGeoLocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("GPS를 지원하지 않습니다");
      return;
    }

    // ✅ watchPosition 대신 getCurrentPosition 사용 (한 번만)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (err) => setError(err.message),
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 60000 // 1분간 캐시 사용
      }
    );

    // cleanup 함수 제거 (watchPosition이 아니므로)
  }, []);

  return { location, error };
}