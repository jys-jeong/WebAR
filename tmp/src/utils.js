export const coordKey = (coord) => `${coord[0].toFixed(8)},${coord[1].toFixed(8)}`;

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const findMarkersWithinRadius = (userLocation, markers, radiusMeters = 100) => {
  if (!userLocation) return [];
  const [userLng, userLat] = userLocation;

  return markers.filter(({ lat, lng }) => {
    return calculateDistance(userLat, userLng, lat, lng) <= radiusMeters;
  });
};