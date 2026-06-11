import {
  loadPm25SamplesById,
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
    points.filter((point) => (
      point?.source !== "simulation" &&
      Number.isFinite(Number(point?.latitude)) &&
      Number.isFinite(Number(point?.longitude))
    ));
  const localPoints = typeof window === "undefined" ? [] : gpsOnly(loadRouteById(id));
  const localSummary = typeof window === "undefined" ? null : loadRouteSummaryById(id);
  const localSamples = typeof window === "undefined" ? [] : loadPm25SamplesById(id);

  const mergePoints = (...pointGroups) => {
    const seen = new Set();
    const merged = [];

    pointGroups.flat().forEach((point) => {
      if (!point) return;

      const stamp = timestampMs(point) || "";
      const lat = Number(point.latitude);
      const lon = Number(point.longitude);
      const key = `${point.id || ""}_${stamp}_${Number.isFinite(lat) ? lat.toFixed(5) : ""}_${Number.isFinite(lon) ? lon.toFixed(5) : ""}`;

      if (seen.has(key)) return;
      seen.add(key);
      merged.push(point);
    });

    return merged.sort((a, b) => (timestampMs(a) || 0) - (timestampMs(b) || 0));
  };

  const mergeSummaries = (...summaries) => {
    let merged = summaries.filter(Boolean).reduce((result, summary) => {
      const current = result || {};

      return {
        ...current,
        ...summary,
        distanceKm: Math.max(Number(current.distanceKm) || 0, Number(summary.distanceKm) || 0),
        routeMinutes: Math.max(Number(current.routeMinutes) || 0, Number(summary.routeMinutes) || 0),
        samples: Math.max(Number(current.samples) || 0, Number(summary.samples) || 0),
        pm25SampleCount: Math.max(Number(current.pm25SampleCount) || 0, Number(summary.pm25SampleCount) || 0),
      };
    }, null);

    if (!merged && localSamples.length > 0) {
      merged = {
        routeKind: "gps",
        routeSource: "Time samples",
        samples: localSamples.length,
        pm25SampleCount: localSamples.length,
      };
    }

    if (!merged) return null;

    const summarySamples = summaries.flatMap((summary) => storedPm25Samples(summary));
    const pm25Samples = mergePoints(summarySamples, localSamples);

    return {
      ...merged,
      pm25Samples,
      pm25SampleCount: pm25Samples.length,
      samples: Math.max(Number(merged.samples) || 0, pm25Samples.length),
      routeKind: merged.routeKind || "gps",
      routeSource: merged.routeSource || (pm25Samples.length > 0 ? "Time samples" : ""),
    };
  };

  if (cloudEntry) {
    if (Array.isArray(cloudEntry)) {
      return { points: mergePoints(gpsOnly(cloudEntry), localPoints), summary: mergeSummaries(localSummary) };
    }

    if (cloudEntry.summary?.routeKind === "simulation") {
      return { points: localPoints, summary: mergeSummaries(localSummary) };
    }

    const points = mergePoints(gpsOnly(cloudEntry.points || []), localPoints);
    const summary = mergeSummaries(cloudEntry.summary || null, localSummary);

    return {
      points,
      summary: points.length > 0 || storedPm25Samples(summary).length > 0
        ? summary
        : null,
    };
  }

  if (typeof window === "undefined") return { points: [], summary: null };

  const summary = localSamples.length > storedPm25Samples(localSummary).length
    ? {
        ...(localSummary || {}),
        pm25Samples: localSamples,
        pm25SampleCount: localSamples.length,
        routeKind: localSummary?.routeKind || "gps",
        routeSource: localSummary?.routeSource || "Time samples",
      }
    : localSummary;

  return {
    points: localPoints,
    summary: localPoints.length > 0 || storedPm25Samples(summary).length > 0
      ? summary
      : null,
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

function storedPm25Samples(storedSummary = null) {
  if (!Array.isArray(storedSummary?.pm25Samples)) return [];

  return storedSummary.pm25Samples
    .filter((sample) => pointPm25(sample) !== null)
    .sort((a, b) => (timestampMs(a) || 0) - (timestampMs(b) || 0));
}

function sampleBucketKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(Math.floor(date.getMinutes() / 10) * 10).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function mergeMovementSamples(points, samples) {
  if (!samples.length) return samples;

  const seen = new Set(
    samples.map((sample) => {
      const stamp = timestampMs(sample) || Date.now();
      const city = sample?.city || pointCity(sample);
      return `${sample.sampleKey || sampleBucketKey(stamp)}_${city}`;
    })
  );
  const movementSamples = [];

  points.forEach((point) => {
    const pm25 = pointPm25(point);
    if (pm25 === null) return;

    const timestamp = timestampMs(point) || Date.now();
    const city = pointCity(point);
    const sampleKey = sampleBucketKey(timestamp);
    const key = `${sampleKey}_${city}`;

    if (seen.has(key)) return;
    seen.add(key);

    movementSamples.push({
      ...point,
      source: "movement-sample",
      timestamp,
      sampleKey,
      city,
      pm25,
    });
  });

  return samples.concat(movementSamples)
    .sort((a, b) => (timestampMs(a) || 0) - (timestampMs(b) || 0));
}

function storedPm25Average(storedSummary = null) {
  const avg = Number(storedSummary?.avgPm25);
  if (Number.isFinite(avg) && avg > 0) return avg;

  const legacyLoad = Number(storedSummary?.exposureLoad);
  if (Number.isFinite(legacyLoad) && legacyLoad > 0 && legacyLoad <= 250) {
    return legacyLoad;
  }

  return 0;
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
    storedPm25Average(storedSummary) ||
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

function addIntervalSample(bins, sample) {
  const stamp = timestampMs(sample) || Date.now();
  const pm25 = pointPm25(sample);
  if (pm25 === null) return;

  const hour = new Date(stamp).getHours();
  const bin = bins.find((item) => hour >= item.start && hour < item.end);
  if (!bin) return;

  bin.hits += 1;
  bin.pm25Sum += pm25;
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

function routeDistanceAndMinutes(route = []) {
  let km = 0;
  let minutes = 0;

  for (let index = 1; index < route.length; index += 1) {
    const prev = route[index - 1];
    const curr = route[index];
    const segmentKm = calculateDistanceKm(prev, curr);
    const duration = segmentMinutes(prev, curr, segmentKm);

    km += segmentKm;
    minutes += duration.minutes;
  }

  return { km, minutes };
}

function cityPathFor(route) {
  return route.reduce((path, point) => {
    const city = pointCity(point);
    if (city && path[path.length - 1] !== city) path.push(city);
    return path;
  }, []);
}

function sampleCityPathFor(samples) {
  return samples.reduce((path, sample) => {
    const city = sample?.city || pointCity(sample);
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
  const pm25Samples = mergeMovementSamples(points, storedPm25Samples(storedSummary));
  const hasPm25Samples = pm25Samples.length > 0;

  if (points.length === 0 && !hasPm25Samples) {
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

  if (points.length === 0 && hasPm25Samples) {
    const sampleBins = emptyIntervals();
    const values = pm25Samples.map(pointPm25).filter((value) => value !== null);
    const sampleRoute = pm25Samples.filter((sample) => (
      Number.isFinite(Number(sample?.latitude)) &&
      Number.isFinite(Number(sample?.longitude))
    ));
    let sampleDistance = 0;
    let sampleMinutes = 0;

    for (let index = 1; index < sampleRoute.length; index += 1) {
      const prev = sampleRoute[index - 1];
      const curr = sampleRoute[index];
      const km = calculateDistanceKm(prev, curr);
      const duration = segmentMinutes(prev, curr, km);

      sampleDistance += km;
      sampleMinutes += duration.minutes;
    }

    values.forEach((_, index) => addIntervalSample(sampleBins, pm25Samples[index]));
    const avgPm25 = values.reduce((sum, value) => sum + value, 0) / values.length;
    const peak = Math.max(...values);
    const low = Math.min(...values);
    const summaryDistance = Number(storedSummary?.distanceKm);
    const summaryMinutes = Number(storedSummary?.routeMinutes);
    const bestDistance = Math.max(
      Number.isFinite(summaryDistance) ? summaryDistance : 0,
      sampleDistance
    );
    const bestMinutes = Math.max(
      Number.isFinite(summaryMinutes) ? summaryMinutes : 0,
      sampleMinutes
    );

    return {
      km: Number(bestDistance.toFixed(2)),
      avgPm25: Number(avgPm25.toFixed(1)),
      peak: Number(peak.toFixed(1)),
      low: Number(low.toFixed(1)),
      minutes: Math.round(bestMinutes),
      exposureLoad: Number(avgPm25.toFixed(1)),
      segments: Math.max(0, sampleRoute.length - 1),
      hits: pm25Samples.length,
      intervals: finalizeIntervals(sampleBins),
      cityPath: sampleCityPathFor(pm25Samples),
      durationSource: sampleRoute.length > 1 ? "sample-coordinates" : "time-samples",
      routeMode: storedSummary?.routeMode || "",
      routeSource: storedSummary?.routeSource || (sampleRoute.length > 1 ? "Recovered GPS samples" : "Time samples"),
      sampleCount: pm25Samples.length,
      pm25SampleCount: pm25Samples.length,
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

  const fallbackAvg = storedPm25Average(storedSummary) || pointPm25(points[0]) || 0;
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
  const storedAvgPm25 = storedPm25Average(storedSummary);
  const summaryPeak = Number(storedSummary?.peakPm25);
  const summaryLow = Number(storedSummary?.lowPm25);
  let sampleAvgPm25 = 0;
  let samplePeak = 0;
  let sampleLow = 0;
  let sampleIntervals = null;

  if (hasPm25Samples) {
    const sampleBins = emptyIntervals();
    const sampleValues = pm25Samples.map(pointPm25).filter((value) => value !== null);
    pm25Samples.forEach((sample) => addIntervalSample(sampleBins, sample));

    sampleAvgPm25 =
      sampleValues.reduce((sum, value) => sum + value, 0) / sampleValues.length;
    samplePeak = Math.max(...sampleValues);
    sampleLow = Math.min(...sampleValues);
    sampleIntervals = finalizeIntervals(sampleBins);
  }

  const sampleRoute = pm25Samples.filter((sample) => (
    Number.isFinite(Number(sample?.latitude)) &&
    Number.isFinite(Number(sample?.longitude))
  ));
  const sampleRouteStats = routeDistanceAndMinutes(sampleRoute);
  const bestDistance = Math.max(
    Number.isFinite(summaryDistance) ? summaryDistance : 0,
    km,
    sampleRouteStats.km
  );
  const bestMinutes = Math.max(
    Number.isFinite(summaryMinutes) ? summaryMinutes : 0,
    minutes,
    sampleRouteStats.minutes
  );
  const displayedAvgPm25 = hasPm25Samples
    ? Number(sampleAvgPm25.toFixed(1))
    : !measuredPm25 && storedAvgPm25 > 0
      ? storedAvgPm25
      : Number(avgPm25.toFixed(1));
  const primaryCityPath = sampleCityPathFor(pm25Samples);

  return {
    avgPm25: displayedAvgPm25,
    peak: hasPm25Samples
      ? Number(samplePeak.toFixed(1))
      : Number.isFinite(summaryPeak) && summaryPeak > 0
      ? summaryPeak
      : Number((peak || fallbackAvg || 0).toFixed(1)),
    low: hasPm25Samples
      ? Number(sampleLow.toFixed(1))
      : Number.isFinite(summaryLow) && summaryLow > 0
      ? summaryLow
      : Number((low === Number.POSITIVE_INFINITY ? fallbackAvg || 0 : low).toFixed(1)),
    minutes: Math.round(bestMinutes),
    exposureLoad: displayedAvgPm25,
    km: Number(bestDistance.toFixed(2)),
    segments: Math.max(0, points.length - 1),
    hits: hasPm25Samples ? pm25Samples.length : points.length,
    intervals: sampleIntervals || finalizeIntervals(bins),
    cityPath: primaryCityPath.length > 0 ? primaryCityPath : cityPathFor(points),
    durationSource: hasPm25Samples && points.length <= 1
      ? "time-samples"
      : storedSummary?.routeSource === "OSRM"
      ? "road"
      : timestampSegments > 0
        ? "timestamp"
        : "distance",
    routeMode: storedSummary?.routeMode || "",
    routeSource: storedSummary?.routeSource || (hasPm25Samples ? "Time samples" : ""),
    sampleCount: hasPm25Samples ? pm25Samples.length : points.length,
    pm25SampleCount: pm25Samples.length,
    isFallback:
      points.length > 1 &&
      !hasPm25Samples &&
      !measuredPm25 &&
      !storedAvgPm25,
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
      source: stats.hits > 0 || stats.segments > 0 ? "samples" : "no data",
      isPersonal: stats.hits > 0 || stats.segments > 0 || stats.avgPm25 > 0,
    });
  }

  const totalKm = days.reduce((sum, day) => sum + day.km, 0);
  const activeDays = days.filter((day) => day.isPersonal).length;
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
