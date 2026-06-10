import {
  loadRouteById,
  loadRouteSummaryById,
  calculateDistanceKm,
  routeDateId,
} from "@/lib/trackStorage";
import { getNearestCity } from "@/lib/cities";

const DEFAULT_PM25 = 24;
const FALLBACK_SPEED_KMH = 5;
const MAX_SEGMENT_MINUTES_FROM_GPS = 12 * 60;

export const SUMMARY_PERIODS = {
  weekly: { key: "weekly", days: 7, label: "Weekly", shortLabel: "7D" },
  monthly: { key: "monthly", days: 30, label: "Monthly", shortLabel: "30D" },
  yearly: { key: "yearly", days: 365, label: "Yearly", shortLabel: "365D" },
};

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
    points.filter((point) => point?.source === "gps");

  if (cloudEntry) {
    if (Array.isArray(cloudEntry)) return { points: gpsOnly(cloudEntry), summary: null };
    if (cloudEntry.summary?.routeKind === "simulation") {
      return { points: [], summary: null };
    }

    const points = gpsOnly(cloudEntry.points || []);

    return {
      points,
      summary: points.length > 0 ? cloudEntry.summary || null : null,
    };
  }

  if (typeof window === "undefined") return { points: [], summary: null };

  const localPoints = gpsOnly(loadRouteById(id));

  return {
    points: localPoints,
    summary: localPoints.length > 0 ? loadRouteSummaryById(id) : null,
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
    { label: "00–06", start: 0, end: 6, hits: 0, km: 0, minutes: 0, exposureLoad: 0, avgPm25: 0, pm25Sum: 0, pm25Count: 0 },
    { label: "06–12", start: 6, end: 12, hits: 0, km: 0, minutes: 0, exposureLoad: 0, avgPm25: 0, pm25Sum: 0, pm25Count: 0 },
    { label: "12–18", start: 12, end: 18, hits: 0, km: 0, minutes: 0, exposureLoad: 0, avgPm25: 0, pm25Sum: 0, pm25Count: 0 },
    { label: "18–24", start: 18, end: 24, hits: 0, km: 0, minutes: 0, exposureLoad: 0, avgPm25: 0, pm25Sum: 0, pm25Count: 0 },
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
  bin.pm25Sum += segment.pm25;
  bin.pm25Count += 1;
}

function finalizeIntervals(bins) {
  return bins.map((bin) => {
    const avgPm25 = bin.pm25Count > 0
      ? Number((bin.pm25Sum / bin.pm25Count).toFixed(1))
      : 0;

    return {
      ...bin,
      km: Number(bin.km.toFixed(2)),
      minutes: Math.round(bin.minutes),
      avgPm25,
      exposureLoad: avgPm25,
    };
  });
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
  const pmValues = [];
  let peak = 0;
  let low = Number.POSITIVE_INFINITY;
  let timestampSegments = 0;

  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const curr = points[index];
    const segmentKm = calculateDistanceKm(prev, curr);
    const duration = segmentMinutes(prev, curr, segmentKm);
    const segmentPm = segmentPm25(prev, curr, storedSummary);

    km += segmentKm;
    minutes += duration.minutes;
    pmValues.push(segmentPm);
    peak = Math.max(peak, segmentPm);
    low = Math.min(low, segmentPm);
    if (duration.source === "timestamp") timestampSegments += 1;

    addIntervalSegment(bins, {
      prev,
      curr,
      km: segmentKm,
      minutes: duration.minutes,
      pm25: segmentPm,
    });
  }

  const fallbackAvg = Number(storedSummary?.avgPm25) || pointPm25(points[0]) || 0;
  const measuredPm25 = hasMeasuredPm25(points);
  const avgPm25 = pmValues.length > 0
    ? pmValues.reduce((sum, value) => sum + value, 0) / pmValues.length
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
    avgPm25: !measuredPm25 && Number.isFinite(summaryAvg) && summaryAvg > 0
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
    exposureLoad: !measuredPm25 && Number.isFinite(summaryExposure) && summaryExposure > 0
      ? Number(summaryExposure.toFixed(1))
      : Number(avgPm25.toFixed(1)),
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
      !measuredPm25 &&
      !Number(storedSummary?.avgPm25),
  };
}

export function buildPeriodSummary(routeMap = null, dayCount = SUMMARY_PERIODS.weekly.days) {
  const days = [];

  for (let i = 0; i < dayCount; i += 1) {
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
  const activeDays = days.filter((day) => day.km > 0).length;
  const activeRouteDays = days.filter((day) => day.isPersonal && day.avgPm25 > 0);

  const avgPm25 =
    activeRouteDays.length > 0
      ? activeRouteDays.reduce((sum, day) => sum + day.avgPm25, 0) /
        activeRouteDays.length
      : 0;
  const peakPm25 = activeRouteDays.length > 0
    ? Math.max(...activeRouteDays.map((day) => day.peak || 0))
    : 0;
  const lowPm25 = activeRouteDays.length > 0
    ? Math.min(...activeRouteDays.map((day) => day.low || 0).filter((value) => value > 0))
    : 0;

  return {
    days,
    totalKm: Number(totalKm.toFixed(2)),
    totalExposure: Number(avgPm25.toFixed(1)),
    activeDays,
    avgPm25: Number(avgPm25.toFixed(1)),
    peakPm25: Number(peakPm25.toFixed(1)),
    lowPm25: Number((Number.isFinite(lowPm25) ? lowPm25 : 0).toFixed(1)),
    dayCount,
  };
}

export function buildWeeklySummary(routeMap = null) {
  return buildPeriodSummary(routeMap, SUMMARY_PERIODS.weekly.days);
}

export function buildAllSummaries(routeMap = null) {
  return Object.values(SUMMARY_PERIODS).reduce((result, period) => ({
    ...result,
    [period.key]: buildPeriodSummary(routeMap, period.days),
  }), {});
}
