import { loadTodayRoute, getTodayDistance } from "@/lib/trackStorage";

function dateKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);

  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  return `${y}_${m}_${day}`;
}

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

function getStoredRouteByOffset(offset) {
  if (typeof window === "undefined") return [];

  if (offset === 0) return loadTodayRoute();

  const key = `pmp25_today_route_${dateKey(offset)}`;
  const raw = localStorage.getItem(key);

  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function exposureRisk(score) {
  if (score <= 15) return { label: "LOW", color: "#34C759" };
  if (score <= 40) return { label: "MODERATE", color: "#FFCC00" };
  if (score <= 80) return { label: "HIGH", color: "#FF9500" };
  return { label: "VERY HIGH", color: "#FF3B30" };
}

function buildIntervals(route, avgPm25, totalMinutes) {
  const bins = [
    { label: "00–06", start: 0, end: 6, hits: 0, minutes: 0, exposureLoad: 0, avgPm25: 0 },
    { label: "06–12", start: 6, end: 12, hits: 0, minutes: 0, exposureLoad: 0, avgPm25: 0 },
    { label: "12–18", start: 12, end: 18, hits: 0, minutes: 0, exposureLoad: 0, avgPm25: 0 },
    { label: "18–24", start: 18, end: 24, hits: 0, minutes: 0, exposureLoad: 0, avgPm25: 0 },
  ];

  if (!route || route.length === 0 || totalMinutes === 0) {
    return bins;
  }

  const minutesPerPoint = totalMinutes / Math.max(1, route.length);

  route.forEach((point) => {
    const hour = new Date(point.timestamp || Date.now()).getHours();
    const bin = bins.find((item) => hour >= item.start && hour < item.end);

    if (!bin) return;

    bin.hits += 1;
    bin.minutes += minutesPerPoint;
  });

  return bins.map((bin) => {
    const exposureLoad = avgPm25 * (bin.minutes / 60) * 1.35;

    return {
      ...bin,
      minutes: Math.round(bin.minutes),
      avgPm25: bin.hits > 0 ? avgPm25 : 0,
      exposureLoad: Number(exposureLoad.toFixed(1)),
    };
  });
}

export function buildWeeklySummary() {
  const days = [];

  for (let i = 0; i < 7; i += 1) {
    const route = getStoredRouteByOffset(i);
    const km = getTodayDistance(route);

    const estimatedMinutes = km > 0 ? Math.round((km / 5) * 60) : 0;

    // Temporary until Home stores PM2.5 per segment:
    // this keeps the original Summary structure working now.
    const avgPm25 = km > 0 ? 24 : 0;
    const peak = km > 0 ? 31 : 0;
    const low = km > 0 ? 18 : 0;

    const exposureLoad = Number(
      (avgPm25 * (estimatedMinutes / 60) * 1.35).toFixed(1)
    );

    const intervals = buildIntervals(route, avgPm25, estimatedMinutes);

    days.push({
      id: dateKey(i),
      dayName: dayName(i),
      date: displayDate(i),
      km: Number(km.toFixed(2)),
      avgPm25,
      peak,
      low,
      minutes: estimatedMinutes,
      exposureLoad,
      segments: Math.max(0, route.length - 1),
      hits: route.length,
      intervals,
      risk: exposureRisk(exposureLoad),
      source: route.length > 0 ? "route" : "no data",
      isPersonal: route.length > 0,
      isFallback: false,
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
