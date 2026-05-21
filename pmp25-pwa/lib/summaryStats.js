import {
  loadRouteById,
  loadRouteSummaryById,
  calculateDistanceKm,
  routeDateId,
} from "@/lib/trackStorage";
import { getNearestCity } from "@/lib/cities";

const DEFAULT_PM25 = 24;
const FALLBACK_SPEED_KMH = 5;
const EXPOSURE_MULTIPLIER = 1.35;
const MAX_SEGMENT_MINUTES_FROM_GPS = 12 * 60;

function displayDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function dayName(offset = 0) {
  if (offset === 0) return "TODAY";

  const d = new Date();
  d.setDate(d.getDate() - offset);

  return d.toLocaleDateString("en-US", {
    weekday: "short",
  }).toUpperCase();
}

function getStoredRouteEntryByOffset(offset, routeMap = null) {
  const id = routeDateId(offset);
  const cloudEntry = routeMap?.[id];
  const gpsOnly = (points = []) =>
    points.filter((point) => point?.source !== "simulation");

  if (cloudEntry) {
    if (Array.isArray(cloudEntry)) return { points: gpsOnly(cloudEntry), summary: null };
    if (cloudEntry.summary?.routeKind === "simulation") {
      return { points: [], summary: null };
    }

    return {
      points: gpsOnly(cloudEntry.points || []),
      summary: cloudEntry.summary || null,
    };
  }

  if (typeof window === "undefined") return { points: [], summary: null };

  return {
    points: gpsOnly(loadRouteById(id)),
    summary: loadRouteSummaryById(id),
  };
}

export function exposureRisk(score) {
  if (score <= 15) return { label: "LOW", color: "#34C759" };
  if (score <= 40) return { label: "MODERATE", color: "#FFCC00" };
  if (score <= 80) return { label: "HIGH", color: "#FF9500" };
  return { label: "VERY HIGH", color: "#FF3B30" };
}

function emptyIntervals() {
  return [
    { label: "00–06", start: 0, end: 6, hits: 0, km: 0, minutes: 0, exposureLoad: 0, avgPm25: 0, pm25WeightedMinutes: 0 },
    { label: "06–12", start: 6, end: 12, hits: 0, km: 0, minutes: 0, exposureLoad: 0, avgPm25: 0, pm25WeightedMinutes: 0 },
    { label: "12–18", start: 12, end: 18, hits: 0, km: 0, minutes: 0, exposureLoad: 0, avgPm25: 0, pm25WeightedMinutes: 0 },
    { label: "18–24", start: 18, end: 24, hits: 0, km: 0, minutes: 0, exposureLoad: 0, avgPm25: 0, pm25WeightedMinutes: 0 },
  ];
}

function timestampMs(point) {
  const value = Number(point?.timestamp);
  return Number.isFinite(value) ? value : null;
}

function pointCity(point) {
  if (point?.city) return point.city;
  if (!Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude)) {
    return "";
  }

  return getNearestCity(point.latitude, point.longitude);
}

function pointPm25(point) {
  const value = Number(point?.pm25);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function fallbackMinutesForDistance(km) {
  return km > 0 ? (km / FALLBACK_SPEED_KMH) * 60 : 0;
}

function segmentMinutes(prev, curr, km) {
  const prevTime = timestampMs(prev);
  const currTime = timestampMs(curr);

  if (prevTime && currTime && currTime > prevTime) {
    const minutes = (currTime - prevTime) / 60000;
    if (minutes <= MAX_SEGMENT_MINUTES_FROM_GPS) {
      return { minutes, source: "timestamp" };
    }
  }

  return { minutes: fallbackMinutesForDistance(km), source: "distance" };
}

function segmentPm25(prev, curr, storedSummary) {
  return (
    pointPm25(curr) ||
    pointPm25(prev) ||
    Number(storedSummary?.avgPm25) ||
    DEFAULT_PM25
  );
}

function addIntervalSegment(bins, segment) {
  const stamp = timestampMs(segment.curr) || timestampMs(segment.prev) || Date.now();
  const hour = new Date(stamp).getHours();
  const bin = bins.find((item) => hour >= item.start && hour < item.end);

  if (!bin) return;

  bin.hits += 1;
  bin.km += segment.km;
  bin.minutes += segment.minutes;
  bin.exposureLoad += segment.exposureLoad;
  bin.pm25WeightedMinutes += segment.pm25 * segment.minutes;
}

function finalizeIntervals(bins) {
  return bins.map((bin) => ({
    ...bin,
    km: Number(bin.km.toFixed(2)),
    minutes: Math.round(bin.minutes),
    avgPm25:
      bin.minutes > 0
        ? Number((bin.pm25WeightedMinutes / bin.minutes).toFixed(1))
        : 0,
    exposureLoad: Number(bin.exposureLoad.toFixed(1)),
  }));
}

function cityPathFor(route) {
  return route.reduce((path, point) => {
    const city = pointCity(point);
    if (city && path[path.length - 1] !== city) path.push(city);
    return path;
  }, []);
}

function hasMeasuredPm25(route) {
  return route.some((point) => pointPm25(point) !== null);
}

export function buildRouteStats(route = [], storedSummary = null) {
  const points = Array.isArray(route) ? route : [];
  const bins = emptyIntervals();

  if (points.length === 0) {
    return {
      km: 0,
      avgPm25: 0,
      peak: 0,
      low: 0,
      minutes: 0,
      exposureLoad: 0,
      segments: 0,
      hits: 0,
      intervals: finalizeIntervals(bins),
      cityPath: [],
      durationSource: "none",
      isFallback: false,
    };
  }

  let km = 0;
  let minutes = 0;
  let exposureLoad = 0;
  let weightedPmByMinutes = 0;
  let peak = 0;
  let low = Number.POSITIVE_INFINITY;
  let timestampSegments = 0;

  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const curr = points[index];
    const segmentKm = calculateDistanceKm(prev, curr);
    const duration = segmentMinutes(prev, curr, segmentKm);
    const segmentPm = segmentPm25(prev, curr, storedSummary);
    const segmentLoad =
      segmentPm * (duration.minutes / 60) * EXPOSURE_MULTIPLIER;

    km += segmentKm;
    minutes += duration.minutes;
    exposureLoad += segmentLoad;
    weightedPmByMinutes += segmentPm * duration.minutes;
    peak = Math.max(peak, segmentPm);
    low = Math.min(low, segmentPm);
    if (duration.source === "timestamp") timestampSegments += 1;

    addIntervalSegment(bins, {
      prev,
      curr,
      km: segmentKm,
      minutes: duration.minutes,
      pm25: segmentPm,
      exposureLoad: segmentLoad,
    });
  }

  const fallbackAvg = Number(storedSummary?.avgPm25) || pointPm25(points[0]) || 0;
  const avgPm25 =
    minutes > 0
      ? weightedPmByMinutes / minutes
      : fallbackAvg;

  if (points.length === 1 && fallbackAvg > 0) {
    peak = fallbackAvg;
    low = fallbackAvg;
  }

  const summaryDistance = Number(storedSummary?.distanceKm);
  const summaryMinutes = Number(storedSummary?.routeMinutes);
  const summaryExposure = Number(storedSummary?.exposureLoad);
  const summaryAvg = Number(storedSummary?.avgPm25);
  const summaryPeak = Number(storedSummary?.peakPm25);
  const summaryLow = Number(storedSummary?.lowPm25);

  return {
    avgPm25: Number.isFinite(summaryAvg) && summaryAvg > 0
      ? summaryAvg
      : Number(avgPm25.toFixed(1)),
    peak: Number.isFinite(summaryPeak) && summaryPeak > 0
      ? summaryPeak
      : Number((peak || fallbackAvg || 0).toFixed(1)),
    low: Number.isFinite(summaryLow) && summaryLow > 0
      ? summaryLow
      : Number((low === Number.POSITIVE_INFINITY ? fallbackAvg || 0 : low).toFixed(1)),
    minutes: Number.isFinite(summaryMinutes) && summaryMinutes > 0
      ? Math.round(summaryMinutes)
      : Math.round(minutes),
    exposureLoad: Number.isFinite(summaryExposure) && summaryExposure > 0
      ? Number(summaryExposure.toFixed(1))
      : Number(exposureLoad.toFixed(1)),
    km: Number.isFinite(summaryDistance) && summaryDistance > 0
      ? Number(summaryDistance.toFixed(2))
      : Number(km.toFixed(2)),
    segments: Math.max(0, points.length - 1),
    hits: points.length,
    intervals: finalizeIntervals(bins),
    cityPath: cityPathFor(points),
    durationSource: storedSummary?.routeSource
      ? "road"
      : timestampSegments > 0
        ? "timestamp"
        : "distance",
    routeMode: storedSummary?.routeMode || "",
    routeSource: storedSummary?.routeSource || "",
    isFallback:
      points.length > 1 &&
      !hasMeasuredPm25(points) &&
      !Number(storedSummary?.avgPm25),
  };
}

export function buildWeeklySummary(routeMap = null) {
  const days = [];

  for (let i = 0; i < 7; i += 1) {
    const entry = getStoredRouteEntryByOffset(i, routeMap);
    const stats = buildRouteStats(entry.points, entry.summary);

    days.push({
      id: routeDateId(i),
      dayName: dayName(i),
      date: displayDate(i),
      ...stats,
      risk: exposureRisk(stats.exposureLoad),
      source: stats.hits > 0 ? "route" : "no data",
      isPersonal: stats.hits > 0,
    });
  }

  const totalKm = days.reduce((sum, day) => sum + day.km, 0);
  const totalExposure = days.reduce((sum, day) => sum + day.exposureLoad, 0);
  const activeDays = days.filter((day) => day.km > 0).length;

  const avgPm25 =
    activeDays > 0
      ? days.reduce((sum, day) => sum + (day.km > 0 ? day.avgPm25 : 0), 0) /
        activeDays
      : 0;

  return {
    days,
    totalKm: Number(totalKm.toFixed(2)),
    totalExposure: Number(totalExposure.toFixed(1)),
    activeDays,
    avgPm25: Number(avgPm25.toFixed(1)),
  };
}
