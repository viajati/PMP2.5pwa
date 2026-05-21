const ROUTE_KEY = "pmp25_real_gps_route";
const ROUTE_SUMMARY_KEY = "pmp25_real_gps_route_summary";
const SIMULATION_ROUTE_KEY = "pmp25_simulation_route";

export function routeDateId(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return `${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}`;
}

export function getTodayRouteId() {
  return routeDateId(0);
}

function getRouteKey(routeId = getTodayRouteId()) {
  return `${ROUTE_KEY}_${routeId}`;
}

function getRouteSummaryKey(routeId = getTodayRouteId()) {
  return `${ROUTE_SUMMARY_KEY}_${routeId}`;
}

function getSimulationRouteKey(routeId = getTodayRouteId()) {
  return `${SIMULATION_ROUTE_KEY}_${routeId}`;
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
  return loadRouteById(getTodayRouteId());
}

export function loadRouteById(routeId) {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(getRouteKey(routeId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTodayRoute(route) {
  saveRouteById(getTodayRouteId(), route);
}

export function saveRouteById(routeId, route) {
  if (typeof window === "undefined") return;

  localStorage.setItem(getRouteKey(routeId), JSON.stringify(route));
}

export function loadRouteSummaryById(routeId = getTodayRouteId()) {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(getRouteSummaryKey(routeId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveRouteSummaryById(routeId, summary) {
  if (typeof window === "undefined") return;

  localStorage.setItem(getRouteSummaryKey(routeId), JSON.stringify(summary));
}

export function loadTodayRouteSummary() {
  return loadRouteSummaryById(getTodayRouteId());
}

export function saveTodayRouteSummary(summary) {
  saveRouteSummaryById(getTodayRouteId(), summary);
}

export function getTodayDistance(route = loadTodayRoute()) {
  if (!route || route.length < 2) return 0;

  let total = 0;

  for (let i = 1; i < route.length; i += 1) {
    total += calculateDistanceKm(route[i - 1], route[i]);
  }

  return total;
}

export function appendPoint(latitude, longitude, metadata = {}) {
  const route = loadTodayRoute();

  const nextPoint = {
    source: "gps",
    ...metadata,
    latitude,
    longitude,
    timestamp: metadata.timestamp || Date.now(),
  };

  const nextRoute = [...route, nextPoint];
  saveTodayRoute(nextRoute);

  return {
    route: nextRoute,
    distance: getTodayDistance(nextRoute),
  };
}

export function loadTodaySimulationRoute() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(getSimulationRouteKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTodaySimulationRoute(route) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getSimulationRouteKey(), JSON.stringify(route));
}

export function appendSimulationPoint(latitude, longitude, metadata = {}) {
  const route = loadTodaySimulationRoute();

  const nextPoint = {
    source: "simulation",
    ...metadata,
    latitude,
    longitude,
    timestamp: metadata.timestamp || Date.now(),
  };

  const nextRoute = [...route, nextPoint];
  saveTodaySimulationRoute(nextRoute);

  return {
    route: nextRoute,
    distance: getTodayDistance(nextRoute),
  };
}

export function clearTodaySimulationRoute() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getSimulationRouteKey());
}

export function clearTodayRoute() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(getRouteKey(getTodayRouteId()));
  localStorage.removeItem(getRouteSummaryKey(getTodayRouteId()));
}
