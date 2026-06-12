const ROUTE_KEY = "pmp25_real_gps_route";
const ROUTE_SUMMARY_KEY = "pmp25_real_gps_route_summary";
const SIMULATION_ROUTE_KEY = "pmp25_simulation_route";
const PM25_SAMPLES_KEY = "pmp25_pm25_samples";
const MAX_GPS_ACCURACY_M = 120;
const MIN_MOVEMENT_SEGMENT_KM = 0.05;
const MAX_LOW_SPEED_JITTER_KM = 0.25;
const MIN_MOVING_SPEED_KMH = 2;
const MAX_REASONABLE_SPEED_KMH = 180;

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

function getPm25SamplesKey(routeId = getTodayRouteId()) {
  return `${PM25_SAMPLES_KEY}_${routeId}`;
}

function localSampleKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(Math.floor(date.getMinutes() / 10) * 10).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
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

function timestampMs(point) {
  const value = Number(point?.timestamp);
  return Number.isFinite(value) ? value : null;
}

function pointAccuracyM(point) {
  const value = Number(point?.accuracy);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function hasUsableGpsAccuracy(point) {
  const accuracy = pointAccuracyM(point);
  return accuracy === null || accuracy <= MAX_GPS_ACCURACY_M;
}

export function movementSegmentStats(prev, curr) {
  if (!prev || !curr) {
    return { counted: false, km: 0, minutes: 0, speedKmh: 0, reason: "missing-point" };
  }

  if (!hasUsableGpsAccuracy(prev) || !hasUsableGpsAccuracy(curr)) {
    return { counted: false, km: 0, minutes: 0, speedKmh: 0, reason: "low-accuracy" };
  }

  const km = calculateDistanceKm(prev, curr);
  const prevAccuracy = pointAccuracyM(prev) || 0;
  const currAccuracy = pointAccuracyM(curr) || 0;
  const accuracyFloorKm = Math.min(0.3, (prevAccuracy + currAccuracy) / 1000);
  const minSegmentKm = Math.max(MIN_MOVEMENT_SEGMENT_KM, accuracyFloorKm);

  if (!Number.isFinite(km) || km < minSegmentKm) {
    return { counted: false, km: 0, minutes: 0, speedKmh: 0, reason: "within-gps-noise" };
  }

  const prevTime = timestampMs(prev);
  const currTime = timestampMs(curr);
  const minutes =
    prevTime && currTime && currTime > prevTime ? (currTime - prevTime) / 60000 : 0;
  const speedKmh = minutes > 0 ? km / (minutes / 60) : 0;

  if (minutes > 0 && speedKmh > MAX_REASONABLE_SPEED_KMH) {
    return { counted: false, km: 0, minutes, speedKmh, reason: "unrealistic-speed" };
  }

  if (minutes > 0 && km < MAX_LOW_SPEED_JITTER_KM && speedKmh < MIN_MOVING_SPEED_KMH) {
    return { counted: false, km: 0, minutes, speedKmh, reason: "stationary-jitter" };
  }

  if (minutes >= 30 && km < 2 && speedKmh < 2.5) {
    return { counted: false, km: 0, minutes, speedKmh, reason: "long-idle-drift" };
  }

  return { counted: true, km, minutes, speedKmh, reason: "movement" };
}

export function calculateRouteDistanceKm(route = []) {
  if (!route || route.length < 2) return 0;

  let total = 0;

  for (let i = 1; i < route.length; i += 1) {
    const segment = movementSegmentStats(route[i - 1], route[i]);
    if (segment.counted) total += segment.km;
  }

  return total;
}

export function movementRoutePoints(route = []) {
  if (!route || route.length < 2) return [];

  const points = [];

  for (let i = 1; i < route.length; i += 1) {
    const prev = route[i - 1];
    const curr = route[i];
    const segment = movementSegmentStats(prev, curr);
    if (!segment.counted) continue;

    if (points.length === 0) {
      points.push(prev);
    } else {
      const last = points[points.length - 1];
      if (last !== prev) points.push(prev);
    }

    points.push(curr);
  }

  return points;
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

export function loadPm25SamplesById(routeId = getTodayRouteId()) {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(getPm25SamplesKey(routeId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePm25SamplesById(routeId, samples) {
  if (typeof window === "undefined") return;

  localStorage.setItem(getPm25SamplesKey(routeId), JSON.stringify(samples));
}

export function loadTodayPm25Samples() {
  return loadPm25SamplesById(getTodayRouteId());
}

export function appendPm25Sample(sample, routeId = getTodayRouteId()) {
  const pm25 = Number(sample?.pm25);
  if (!Number.isFinite(pm25) || pm25 <= 0) {
    return loadPm25SamplesById(routeId);
  }

  const samples = loadPm25SamplesById(routeId);
  const timestamp = Number(sample?.timestamp) || Date.now();
  const sampleKey = sample?.sampleKey || localSampleKey(timestamp);
  const hourKey = sample?.hourKey || sampleKey.slice(0, 13);
  const city = sample?.city || "Unknown";
  const lat = Number(sample?.latitude);
  const lon = Number(sample?.longitude);
  const locationKey =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(2)}_${lon.toFixed(2)}`
      : city;
  const id = sample?.id || `${sampleKey}_${city}_${locationKey}`;

  const nextSample = {
    source: "time-sample",
    ...sample,
    id,
    sampleKey,
    city,
    hourKey,
    timestamp,
    pm25: Number(pm25.toFixed(1)),
  };

  const nextSamples = samples
    .filter((item) => item?.id !== id)
    .concat(nextSample)
    .sort((a, b) => (Number(a?.timestamp) || 0) - (Number(b?.timestamp) || 0));

  savePm25SamplesById(routeId, nextSamples);
  return nextSamples;
}

export function getTodayDistance(route = loadTodayRoute()) {
  return calculateRouteDistanceKm(route);
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

  if (!hasUsableGpsAccuracy(nextPoint)) {
    return {
      route,
      distance: getTodayDistance(route),
      accepted: false,
      ignoredReason: "low-accuracy",
    };
  }

  if (route.length > 0) {
    const segment = movementSegmentStats(route[route.length - 1], nextPoint);

    if (!segment.counted) {
      return {
        route,
        distance: getTodayDistance(route),
        accepted: false,
        ignoredReason: segment.reason,
      };
    }
  }

  const nextRoute = [...route, nextPoint];
  saveTodayRoute(nextRoute);

  return {
    route: nextRoute,
    distance: getTodayDistance(nextRoute),
    accepted: true,
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
  localStorage.removeItem(getPm25SamplesKey(getTodayRouteId()));
}
