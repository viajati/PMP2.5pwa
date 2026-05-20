import { CITY_COORDS, REGIONS } from "@/lib/cities";

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

export async function fetchAllCityAirQuality() {
  const cityNames = Object.keys(CITY_COORDS);
  const lats = cityNames.map((city) => CITY_COORDS[city].latitude).join(",");
  const lons = cityNames.map((city) => CITY_COORDS[city].longitude).join(",");

  const aqUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
    `&current=pm2_5,pm10,carbon_monoxide&timezone=Asia/Taipei`;

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia/Taipei`;

  const [aqRes, weatherRes] = await Promise.all([
    fetchWithTimeout(aqUrl),
    fetchWithTimeout(weatherUrl),
  ]);

  if (!aqRes.ok) throw new Error("Failed to fetch air quality");
  if (!weatherRes.ok) throw new Error("Failed to fetch weather");

  const aqJson = await aqRes.json();
  const weatherJson = await weatherRes.json();

  return cityNames.map((city, index) => {
    const aqItem = Array.isArray(aqJson) ? aqJson[index] : aqJson;
    const weatherItem = Array.isArray(weatherJson) ? weatherJson[index] : weatherJson;

    const aq = aqItem?.current || {};
    const weather = weatherItem?.current || {};

    return {
      county: city,
      region: cityRegion(city),
      pm25: Number((aq.pm2_5 ?? 0).toFixed(1)),
      pm10: Number((aq.pm10 ?? 0).toFixed(1)),
      co: Number((aq.carbon_monoxide ?? 0).toFixed(1)),
      temp: weather.temperature_2m ?? null,
      humidity: weather.relative_humidity_2m ?? null,
      weatherCode: weather.weather_code ?? null,
      windSpeed: weather.wind_speed_10m ?? null,
      time: aq.time ? aq.time.replace("T", " ") : "Now",
      source: "open-meteo",
    };
  });
}

export async function fetchHourlyAirQuality(city, forecastDays = 1) {
  const coords = CITY_COORDS[city];
  if (!coords) throw new Error(`Unknown city: ${city}`);

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.latitude}&longitude=${coords.longitude}` +
    `&hourly=pm2_5,pm10,carbon_monoxide&forecast_days=${forecastDays}&timezone=Asia/Taipei`;

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
    pm25: Number((pm25[index] ?? 0).toFixed(1)),
    pm10: Number((pm10[index] ?? 0).toFixed(1)),
    co: Number((co[index] ?? 0).toFixed(1)),
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
    const avgPm25 =
      count > 0
        ? group.rows.reduce((sum, row) => sum + row.pm25, 0) / count
        : 0;

    return {
      label: group.label,
      count,
      avgPm25: Number(avgPm25.toFixed(1)),
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

  return Array.from(byDate.entries()).slice(0, 7).map(([date, rows]) => {
    const avgPm25 =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.pm25, 0) / rows.length
        : 0;

    const avgPm10 =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.pm10, 0) / rows.length
        : 0;

    const avgCo =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.co, 0) / rows.length
        : 0;

    const d = new Date(date);

    return {
      date,
      day: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      pm25: Number(avgPm25.toFixed(1)),
      pm10: Number(avgPm10.toFixed(1)),
      co: Number(avgCo.toFixed(1)),
    };
  });
}
