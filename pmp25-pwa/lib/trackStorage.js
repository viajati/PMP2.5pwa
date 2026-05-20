const ROUTE_KEY = "pmp25_today_route";

function getTodayKey() {
  const today = new Date();
  return `${ROUTE_KEY}_${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}`;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(pointA, pointB) {
  const earthRadiusKm = 6371;

  const dLat = toRadians(pointB.latitude - pointA.latitude);
  const dLon = toRadians(pointB.longitude - pointA.longitude);

  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function loadTodayRoute() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(getTodayKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTodayRoute(route) {
  if (typeof window === "undefined") return;

  localStorage.setItem(getTodayKey(), JSON.stringify(route));
}

export function getTodayDistance(route = loadTodayRoute()) {
  if (!route || route.length < 2) return 0;

  let total = 0;

  for (let i = 1; i < route.length; i += 1) {
    total += calculateDistanceKm(route[i - 1], route[i]);
  }

  return total;
}

export function appendPoint(latitude, longitude) {
  const route = loadTodayRoute();

  const nextPoint = {
    latitude,
    longitude,
    timestamp: Date.now(),
  };

  const nextRoute = [...route, nextPoint];
  saveTodayRoute(nextRoute);

  return {
    route: nextRoute,
    distance: getTodayDistance(nextRoute),
  };
}

export function clearTodayRoute() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(getTodayKey());
}