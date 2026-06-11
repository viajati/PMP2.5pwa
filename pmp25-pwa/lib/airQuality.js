import { CITY_COORDS, REGIONS } from "@/lib/cities";

export const OPEN_METEO_TIMEZONE = "Asia/Taipei";

function cityRegion(city) {
  for (const [region, cities] of Object.entries(REGIONS)) {
    if (cities.includes(city)) return region;
  }
  return "NORTH";
}

function fetchWithTimeout(url, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return fetch(url, { signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

function roundedNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function average(values) {
  const validValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (validValues.length === 0) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function dateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchAllCityAirQuality() {
  const cityNames = Object.keys(CITY_COORDS);
  const lats = cityNames.map((city) => CITY_COORDS[city].latitude).join(",");
  const lons = cityNames.map((city) => CITY_COORDS[city].longitude).join(",");

  const aqUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
    `&current=pm2_5,pm10,carbon_monoxide&timezone=${encodeURIComponent(OPEN_METEO_TIMEZONE)}`;

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=${encodeURIComponent(OPEN_METEO_TIMEZONE)}`;

  const [aqResult, weatherResult] = await Promise.allSettled([
    fetchWithTimeout(aqUrl),
    fetchWithTimeout(weatherUrl),
  ]);

  if (aqResult.status !== "fulfilled" || !aqResult.value.ok) {
    throw new Error("Failed to fetch air quality");
  }

  const aqRes = aqResult.value;
  const weatherRes =
    weatherResult.status === "fulfilled" && weatherResult.value.ok
      ? weatherResult.value
      : null;

  const aqJson = await aqRes.json();
  const weatherJson = weatherRes ? await weatherRes.json() : null;

  return cityNames.map((city, index) => {
    const aqItem = Array.isArray(aqJson) ? aqJson[index] : aqJson;
    const weatherItem = Array.isArray(weatherJson) ? weatherJson[index] : weatherJson;

    const aq = aqItem?.current || {};
    const weather = weatherItem?.current || {};

    return {
      county: city,
      region: cityRegion(city),
      pm25: roundedNumber(aq.pm2_5),
      pm10: roundedNumber(aq.pm10),
      co: roundedNumber(aq.carbon_monoxide),
      temp: weather.temperature_2m ?? null,
      humidity: weather.relative_humidity_2m ?? null,
      weatherCode: weather.weather_code ?? null,
      windSpeed: weather.wind_speed_10m ?? null,
      time: aq.time ? aq.time.replace("T", " ") : "Now",
      timezone: aqItem?.timezone || OPEN_METEO_TIMEZONE,
      timezoneAbbreviation: aqItem?.timezone_abbreviation || "GMT+8",
      utcOffsetSeconds: aqItem?.utc_offset_seconds ?? 28800,
      apiLatitude: aqItem?.latitude ?? null,
      apiLongitude: aqItem?.longitude ?? null,
      apiElevation: aqItem?.elevation ?? null,
      inputLatitude: CITY_COORDS[city].latitude,
      inputLongitude: CITY_COORDS[city].longitude,
      source: "open-meteo",
    };
  });
}

export async function fetchHourlyAirQuality(city, forecastDays = 1) {
  const coords = CITY_COORDS[city];
  if (!coords) throw new Error(`Unknown city: ${city}`);

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.latitude}&longitude=${coords.longitude}` +
    `&hourly=pm2_5,pm10,carbon_monoxide&forecast_days=${forecastDays}&timezone=${encodeURIComponent(OPEN_METEO_TIMEZONE)}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error("Failed to fetch hourly forecast");

  const data = await res.json();
  const hourly = data.hourly || {};

  const times = hourly.time || [];
  const pm25 = hourly.pm2_5 || [];
  const pm10 = hourly.pm10 || [];
  const co = hourly.carbon_monoxide || [];

  return times.map((time, index) => ({
    time,
    label: time.replace("T", " "),
    date: time.split("T")[0],
    hour: Number(time.split("T")[1]?.split(":")[0] ?? 0),
    pm25: roundedNumber(pm25[index]),
    pm10: roundedNumber(pm10[index]),
    co: roundedNumber(co[index]),
    timezone: data.timezone || OPEN_METEO_TIMEZONE,
    timezoneAbbreviation: data.timezone_abbreviation || "GMT+8",
    utcOffsetSeconds: data.utc_offset_seconds ?? 28800,
    apiLatitude: data.latitude ?? null,
    apiLongitude: data.longitude ?? null,
  }));
}

export function groupHourlyForecast(hourlyRows) {
  const groups = [
    { label: "00–06", start: 0, end: 6, rows: [] },
    { label: "06–12", start: 6, end: 12, rows: [] },
    { label: "12–18", start: 12, end: 18, rows: [] },
    { label: "18–24", start: 18, end: 24, rows: [] },
  ];

  hourlyRows.forEach((row) => {
    const group = groups.find((g) => row.hour >= g.start && row.hour < g.end);
    if (group) group.rows.push(row);
  });

  return groups.map((group) => {
    const count = group.rows.length;
    const avgPm25 = average(group.rows.map((row) => row.pm25));

    return {
      label: group.label,
      count,
      avgPm25: avgPm25 === null ? null : Number(avgPm25.toFixed(1)),
      rows: group.rows,
    };
  });
}

export function buildDailyPrediction(hourlyRows) {
  const byDate = new Map();

  hourlyRows.forEach((row) => {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  });

  const firstDate = hourlyRows[0]?.date;
  const startDate = firstDate ? new Date(`${firstDate}T00:00:00`) : new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + index);

    const date = dateString(currentDate);
    const rows = byDate.get(date) || [];
    const avgPm25 = average(rows.map((row) => row.pm25));
    const avgPm10 = average(rows.map((row) => row.pm10));
    const avgCo = average(rows.map((row) => row.co));

    return {
      date,
      day: currentDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      pm25: avgPm25 === null ? null : Number(avgPm25.toFixed(1)),
      pm10: avgPm10 === null ? null : Number(avgPm10.toFixed(1)),
      co: avgCo === null ? null : Number(avgCo.toFixed(1)),
    };
  });
}
