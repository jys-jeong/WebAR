// hooks/useGeoLocation.js
import { useState, useEffect } from 'react';

export default function useGeoLocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("GPS를 지원하지 않습니다");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        console.log("📍 GPS 업데이트:", position.coords.latitude, position.coords.longitude);
      },
      (err) => setError(err.message),
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 1000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { location, error };
}
