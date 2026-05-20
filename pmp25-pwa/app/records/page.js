"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Bike,
  Car,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Footprints,
  Leaf,
  Navigation,
  RefreshCw,
  Route,
  Sparkles,
  Sun,
  TrendingUp,
  Wind,
} from "lucide-react";
import OriginalBottomNav from "@/components/OriginalBottomNav";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { CITY_COORDS, REGIONS } from "@/lib/cities";
import {
  buildDailyPrediction,
  fetchAllCityAirQuality,
  fetchHourlyAirQuality,
} from "@/lib/airQuality";
import { fetchRoute, estimateExposureLoad } from "@/lib/routePlanner";

const RoutePreviewMap = dynamic(() => import("@/components/RoutePreviewMap"), { ssr: false });

const tabs = ["LIVE", "PLANNER", "FORECAST"];
const regions = ["NORTH", "WEST", "SOUTH", "EAST"];

function pmColor(value) {
  if (value <= 15.4) return "#34C759";
  if (value <= 35.4) return "#FFCC00";
  if (value <= 54.4) return "#FF9500";
  return "#FF3B30";
}

function riskLabel(value) {
  if (value <= 15.4) return "GOOD";
  if (value <= 35.4) return "MODERATE";
  if (value <= 54.4) return "POOR";
  return "HIGH";
}

function caqiFrom(pm25, pm10, co) {
  const pm25Score = Math.min(100, (pm25 / 75) * 100);
  const pm10Score = Math.min(100, (pm10 / 150) * 100);
  const coScore = Math.min(100, (co / 2000) * 100);
  return Math.round(Math.max(pm25Score, pm10Score, coScore));
}

function getWeatherMeta(code, windSpeed = 0) {
  if (windSpeed >= 28) return { Icon: Wind, label: "windy", type: "windy" };
  if ([95, 96, 99].includes(code)) return { Icon: CloudLightning, label: "stormy", type: "storm" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { Icon: CloudRain, label: "rainy", type: "rain" };
  if ([45, 48].includes(code)) return { Icon: CloudFog, label: "foggy", type: "cloudy" };
  if (code === 3) return { Icon: Cloud, label: "cloudy", type: "cloudy" };
  if (code === 2) return { Icon: CloudSun, label: "partly cloudy", type: "partly" };
  if (code === 1) return { Icon: CloudSun, label: "mostly sunny", type: "partly" };
  return { Icon: Sun, label: "sunny", type: "sunny" };
}

function heroClass(type, isNight = false) {
  const time = isNight ? "night" : "day";

  if (type === "rain") return `records2-weather-hero records2-weather-rain-${time}`;
  if (type === "storm") return `records2-weather-hero records2-weather-storm-${time}`;
  if (type === "cloudy") return `records2-weather-hero records2-weather-cloudy-${time}`;
  if (type === "partly") return `records2-weather-hero records2-weather-partly-${time}`;
  if (type === "windy") return `records2-weather-hero records2-weather-windy-${time}`;

  return `records2-weather-hero records2-weather-sunny-${time}`;
}

function getHourFromFetchTime(timeValue) {
  if (!timeValue || typeof timeValue !== "string") {
    return new Date().getHours();
  }

  const timePart = timeValue.includes(" ")
    ? timeValue.split(" ")[1]
    : timeValue.includes("T")
      ? timeValue.split("T")[1]
      : timeValue;

  const hour = Number(timePart?.split(":")?.[0]);

  return Number.isFinite(hour) ? hour : new Date().getHours();
}

function isNightHour(hour) {
  return hour < 6 || hour >= 18;
}

function regionFor(city) {
  for (const [region, cities] of Object.entries(REGIONS)) {
    if (cities.includes(city)) return region;
  }
  return "NORTH";
}

function fallbackRows() {
  return Object.keys(CITY_COORDS).map((city) => ({
    county: city,
    region: regionFor(city),
    pm25: 0,
    pm10: 0,
    co: 0,
    temp: "-",
    humidity: "-",
    windSpeed: "-",
    weatherCode: 0,
    time: "Loading",
  }));
}

function distanceBetween(cityA, cityB) {
  const a = CITY_COORDS[cityA];
  const b = CITY_COORDS[cityB];
  if (!a || !b) return 0;

  const dx = a.latitude - b.latitude;
  const dy = a.longitude - b.longitude;
  return Math.sqrt(dx * dx + dy * dy) * 111;
}

function routeMinutesFor(mode, km) {
  if (mode === "walk") return Math.round(km * 12);
  if (mode === "bike") return Math.round(km * 4);
  return Math.round(km * 1.4);
}

function exposureMultiplierFor(mode) {
  if (mode === "walk") return 1.35;
  if (mode === "bike") return 1.6;
  return 1;
}

function labelForMode(mode) {
  if (mode === "walk") return "Walk";
  if (mode === "bike") return "Bike";
  return "Car";
}

export default function RecordsPage() {
  const { t } = useAppPreferences();
  const [mode, setMode] = useState("LIVE");
  const [region, setRegion] = useState("NORTH");
  const [city, setCity] = useState("Taipei City");
  const [rows, setRows] = useState(() => fallbackRows());
  const [loading, setLoading] = useState(true);

  const [startCity, setStartCity] = useState("Taipei City");
  const [endCity, setEndCity] = useState("Hsinchu City");
  const [transport, setTransport] = useState("car");
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [dailyPrediction, setDailyPrediction] = useState([]);

  async function loadData() {
    setLoading(true);

    try {
      const live = await fetchAllCityAirQuality();
      setRows(live);

      const hourly = await fetchHourlyAirQuality(city, 7);
      setDailyPrediction(buildDailyPrediction(hourly));
    } catch (error) {
      console.warn("Records load failed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) loadData();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function refreshForecast() {
      try {
        const hourly = await fetchHourlyAirQuality(city, 7);
        setDailyPrediction(buildDailyPrediction(hourly));
      } catch (error) {
        console.warn("Forecast load failed:", error);
      }
    }

    refreshForecast();
  }, [city]);

  const selected = rows.find((item) => item.county === city) || rows[0];
  const currentHour = getHourFromFetchTime(selected?.time);
  const isNight = isNightHour(currentHour);
  const weather = getWeatherMeta(selected?.weatherCode, selected?.windSpeed);
  const WeatherIcon = weather.Icon;

  const filteredRows = useMemo(() => {
    return rows.filter((item) => item.region === region);
  }, [rows, region]);

  const caqi = caqiFrom(selected?.pm25 || 0, selected?.pm10 || 0, selected?.co || 0);
  const tomorrow = dailyPrediction[1] || dailyPrediction[0] || { pm25: 0, pm10: 0, co: 0 };
  const drift = Number(((tomorrow.pm25 || 0) - (selected?.pm25 || 0)).toFixed(1));

  const routeKm = distanceBetween(startCity, endCity);
  const routeMinutes = routeMinutesFor(transport, routeKm);

  const destination = rows.find((item) => item.county === endCity) || selected;
  const avgRoutePm25 = Number((((selected?.pm25 || 0) + (destination?.pm25 || 0)) / 2).toFixed(1));
  const exposureMultiplier = exposureMultiplierFor(transport);
  const routeLoad = Number((avgRoutePm25 * (routeMinutes / 60) * exposureMultiplier).toFixed(1));
  const displayedDistance = routeData?.distance ?? routeKm;
  const displayedDuration = routeData?.duration ?? routeMinutes;
  const displayedLoad = routeData?.load ?? routeLoad;

  const transportItems = [
    { key: "car", label: "CAR", icon: Car },
    { key: "bike", label: "BIKE", icon: Bike },
    { key: "walk", label: "WALK", icon: Footprints },
  ];

  const tabLabel = {
    LIVE: t("LIVE", "即時"),
    PLANNER: t("PLANNER", "規劃"),
    FORECAST: t("FORECAST", "預測"),
  };

  const regionLabel = {
    NORTH: t("NORTH", "北部"),
    WEST: t("WEST", "西部"),
    SOUTH: t("SOUTH", "南部"),
    EAST: t("EAST", "東部"),
  };

  async function calculateRoute() {
    if (startCity === endCity) {
      setRouteData(null);
      return;
    }

    setRouteLoading(true);

    try {
      const start = CITY_COORDS[startCity];
      const end = CITY_COORDS[endCity];

      const route = await fetchRoute(start, end, transport);

      const fallbackDistance = routeKm;
      const fallbackDuration = routeMinutes;
      const distance = route?.distance ?? fallbackDistance;
      const duration = route?.duration ?? fallbackDuration;
      const load = estimateExposureLoad(avgRoutePm25, duration, transport);

      setRouteData({
        coords: route?.coords || [],
        distance,
        duration,
        load,
        mode: transport,
        source: route?.source || "Estimated",
      });
    } catch (error) {
      console.warn("Calculate route failed:", error);
      setRouteData(null);
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <main className="app-root">
      <div className="phone-frame relative records2-page">
        <section className="app-page-body records-page-body">
          <div className="app-page-header">
            <div>
              <p className="screen-kicker">{t("Archive", "檔案")}</p>
              <h1 className="app-page-title">{t("Records", "紀錄")}</h1>
            </div>

            <button
              onClick={loadData}
              className="app-icon-button"
              title="Refresh records"
            >
              <RefreshCw size={22} strokeWidth={3} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="records2-tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setMode(tab)}
                className={[
                  "records2-tab",
                  mode === tab ? "records2-tab-active" : "",
                ].join(" ")}
              >
                {tabLabel[tab]}
              </button>
            ))}
          </div>

          {mode === "LIVE" && (
            <>
              <div className={heroClass(weather.type, isNight)}>
                <p className="records2-weather-city">
                  {city.replace(" City", "")}
                </p>

                <p className="records2-weather-temp">
                  {selected?.pm25 ?? "-"}
                  <span className="records2-weather-unit">PM2.5</span>
                </p>

                <div className="records2-weather-condition">
                  <WeatherIcon size={28} strokeWidth={3} />
                  <span>{weather.label} · CAQI {caqi}%</span>
                </div>

                <div className="records2-bubble-grid">
                  <div className="records2-bubble">
                    <p className="records2-bubble-label">Temp</p>
                    <p className="records2-bubble-value">{selected?.temp ?? "-"}°</p>
                  </div>

                  <div className="records2-bubble">
                    <p className="records2-bubble-label">Wind</p>
                    <p className="records2-bubble-value">{selected?.windSpeed ?? "-"}km</p>
                  </div>

                  <div className="records2-bubble">
                    <p className="records2-bubble-label">Humidity</p>
                    <p className="records2-bubble-value">{selected?.humidity ?? "-"}%</p>
                  </div>
                </div>
              </div>

              <div className="records2-advice">
                <div className="app-notice-content">
                  <Sparkles size={22} className="app-notice-icon" />
                  <p className="app-notice-text">
                    Safety: Air quality in {city} is {selected?.pm25 ?? 0} µg/m³.
                    {selected?.pm25 > 35
                      ? " Consider reducing prolonged outdoor activity."
                      : " Stay safe."}
                  </p>
                </div>
              </div>

              <div className="records2-region-grid">
                {regions.map((item) => (
                  <button
                    key={regionLabel[item]}
                    onClick={() => setRegion(item)}
                    className={[
                      "records2-region-button",
                      region === item ? "records2-region-active" : "",
                    ].join(" ")}
                  >
                    {regionLabel[item]}
                  </button>
                ))}
              </div>

              <div className="records-section-header">
                <h2 className="app-section-title">{regionLabel[region]} {t("Cities", "城市")}</h2>
                <p className="records-section-meta">
                  {loading
                    ? "Loading..."
                    : `Fetch: ${(selected?.time || "Now").split(" ")[1] || selected?.time}`}
                </p>
              </div>

              <div className="records-list">
                {filteredRows.map((item) => {
                  const meta = getWeatherMeta(item.weatherCode, item.windSpeed);
                  const Icon = meta.Icon;
                  const active = item.county === city;

                  return (
                    <button
                      key={item.county}
                      onClick={() => setCity(item.county)}
                      className={[
                        "records2-city-row",
                        active ? "records2-city-row-active" : "",
                      ].join(" ")}
                    >
                      <div
                        className="records-status-strip"
                        style={{ "--status-color": pmColor(item.pm25) }}
                      />

                      <div className="records2-icon-circle">
                        <Icon size={23} strokeWidth={3} />
                      </div>

                      <div className="records-row-copy">
                        <p className="records-row-title">
                          {item.county}
                        </p>
                        <p className="records-row-meta">
                          {meta.label} · Hum {item.humidity ?? "-"}% · Wind {item.windSpeed ?? "-"} km/h
                        </p>
                      </div>

                      <p className="records-row-value">
                        {item.pm25}
                        <span className="records-row-unit">µg</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "PLANNER" && (
            <>
              <div className="records2-advice">
                <div className="app-notice-content">
                  <Route size={22} className="app-notice-icon" />
                  <p className="app-notice-text">
                    Calculate Route gets the road distance and duration, then estimates exposure load from PM2.5 × travel time × transport exposure.
                  </p>
                </div>
              </div>

              <div className="records-form-grid">
                <div className="records2-card">
                  <p className="records2-label">Origin</p>
                  <select
                    value={startCity}
                    onChange={(e) => {
                      setStartCity(e.target.value);
                      setRouteData(null);
                    }}
                    className="records2-select"
                  >
                    {Object.keys(CITY_COORDS).map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <div className="records2-card">
                  <p className="records2-label">Destination</p>
                  <select
                    value={endCity}
                    onChange={(e) => {
                      setEndCity(e.target.value);
                      setRouteData(null);
                    }}
                    className="records2-select"
                  >
                    {Object.keys(CITY_COORDS).map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="records-toolbar">
                <div className="records-transport-group">
                  {transportItems.map((item) => {
                    const Icon = item.icon;
                    const active = transport === item.key;

                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setTransport(item.key);
                          setRouteData(null);
                        }}
                        className={[
                          "records2-transport",
                          active ? "records2-transport-active" : "",
                        ].join(" ")}
                        title={item.label}
                      >
                        <Icon size={23} strokeWidth={3} />
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={calculateRoute}
                  disabled={routeLoading}
                  className="records-primary-button"
                >
                  {routeLoading ? "CALCULATING" : "CALCULATE"}
                </button>
              </div>

              <div className="records2-card records-route-card">
                <div className="records-route-header">
                  <div>
                    <p className="records2-label">Estimated Route</p>
                    <p className="records2-value">
                      {displayedDistance.toFixed(1)}
                      <span className="records2-unit">KM</span>
                    </p>
                  </div>

                  <Navigation size={34} strokeWidth={2.8} className="app-notice-icon" />
                </div>

                <div className="records-metric-grid">
                  <div className="records2-soft">
                    <p className="records2-label">Time</p>
                    <p className="records2-value records2-value-sm">
                      {Math.round(displayedDuration)}
                      <span className="records2-unit">min</span>
                    </p>
                  </div>

                  <div className="records2-soft">
                    <p className="records2-label">Avg PM2.5</p>
                    <p className="records2-value records2-value-sm">
                      {avgRoutePm25}
                      <span className="records2-unit">µg/m³</span>
                    </p>
                  </div>

                  <div className="records2-soft records-metric-span">
                    <p className="records2-label">Exposure Load</p>
                    <p
                      className="records2-value records2-value-md"
                      style={{ "--value-color": pmColor(avgRoutePm25) }}
                    >
                      {displayedLoad}
                      <span className="records2-unit">score</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="records2-map-preview">
                <RoutePreviewMap
                  start={CITY_COORDS[startCity]}
                  end={CITY_COORDS[endCity]}
                  routeCoords={routeData?.coords || []}
                />
              </div>

              <p className="records-map-note">
                Blue marker = origin. Red marker = destination. Cyan line = calculated route.
              </p>
            </>
          )}

          {mode === "FORECAST" && (
            <div className="forecast-shell forecast-compact">
              <div className="records2-advice">
                <div className="app-notice-content">
                  <Sparkles size={22} className="app-notice-icon" />
                  <p className="app-notice-text">
                    Trend: {drift > 0 ? "PM2.5 may increase tomorrow." : "Stable or lower PM2.5 expected tomorrow."}
                  </p>
                </div>
              </div>

              <div className="forecast-section">
                <div className="forecast-summary-card">
                  <div className="forecast-summary-top">
                    <div>
                      <p className="forecast-label">City Prediction</p>
                      <p className="forecast-city-name">
                        {city}
                      </p>
                    </div>

                    <p className="forecast-time-pill">
                      {(selected?.time || "Now").split(" ")[1] || "Now"}
                    </p>
                  </div>

                  <div className="forecast-caqi-row">
                    <div>
                      <p className="forecast-label">CAQI</p>
                      <p className="forecast-caqi-number">{caqi}</p>

                      <span
                        className="forecast-risk-pill"
                        style={{
                          "--risk-bg": `${pmColor(selected?.pm25 || 0)}22`,
                          "--risk-color": pmColor(selected?.pm25 || 0),
                        }}
                      >
                        {riskLabel(selected?.pm25 || 0)}
                      </span>
                    </div>

                    <div className="forecast-score-stack">
                      <div className="forecast-soft-card">
                        <p className="forecast-label">Actual Now</p>
                        <p className="forecast-value-sm">
                          {Math.round(Math.min(100, ((selected?.pm25 || 0) / 75) * 100))}%
                        </p>
                      </div>

                      <div className="forecast-soft-card">
                        <p className="forecast-label">Tomorrow</p>
                        <p className="forecast-value-sm">
                          {Math.round(Math.min(100, ((tomorrow.pm25 || 0) / 75) * 100))}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="forecast-section">
                <h2 className="forecast-section-title">Live Metrics</h2>

                <div className="forecast-metrics-grid">
                  <div className="forecast-metric-card">
                    <p className="forecast-metric-title">PM2.5</p>
                    <p className="forecast-metric-sub">Fine particles</p>

                    <div className="forecast-metric-row">
                      <p
                        className="forecast-metric-value"
                        style={{ "--value-color": pmColor(selected?.pm25 || 0) }}
                      >
                        {selected?.pm25 || 0}
                      </p>
                      <Sun size={20} color={pmColor(selected?.pm25 || 0)} />
                    </div>
                  </div>

                  <div className="forecast-metric-card">
                    <p className="forecast-metric-title">PM10</p>
                    <p className="forecast-metric-sub">Coarse particles</p>

                    <div className="forecast-metric-row">
                      <p className="forecast-metric-value forecast-metric-warn">
                        {selected?.pm10 || 0}
                      </p>
                      <Cloud size={20} className="forecast-icon-warn" />
                    </div>
                  </div>

                  <div className="forecast-metric-card">
                    <p className="forecast-metric-title">CO</p>
                    <p className="forecast-metric-sub">Carbon monoxide</p>

                    <div className="forecast-metric-row">
                      <p className="forecast-metric-value forecast-metric-good">
                        {selected?.co || 0}
                      </p>
                      <Leaf size={20} className="forecast-icon-good" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="forecast-section">
                <h2 className="forecast-section-title">Future Scope</h2>

                <div className="forecast-future-grid">
                  <div className="forecast-future-cell">
                    <Cloud size={22} className="forecast-icon-muted" />
                    <p className="forecast-future-value">{tomorrow.pm25 || 0}</p>
                    <p className="forecast-future-label">PM2.5</p>
                  </div>

                  <div className="forecast-future-cell">
                    <TrendingUp size={22} className="forecast-icon-muted" />
                    <p className="forecast-future-value">{tomorrow.pm10 || 0}</p>
                    <p className="forecast-future-label">PM10</p>
                  </div>

                  <div className="forecast-future-cell">
                    <Leaf size={22} className="forecast-icon-muted" />
                    <p className="forecast-future-value">{tomorrow.co || 0}</p>
                    <p className="forecast-future-label">CO</p>
                  </div>

                  <div className="forecast-future-cell">
                    <Navigation size={22} className="forecast-icon-muted" />
                    <p
                      className="forecast-future-value"
                      style={{ "--value-color": drift <= 0 ? "#34C759" : "#FF3B30" }}
                    >
                      {drift}
                    </p>
                    <p className="forecast-future-label">Drift</p>
                  </div>
                </div>
              </div>

              <div className="forecast-section">
                <h2 className="forecast-section-title">7-Day Outlook</h2>

                <div className="forecast-week-card">
                  <div className="forecast-week-row">
                    {dailyPrediction.map((day) => (
                      <div key={day.date}>
                        <p className="forecast-week-day">{day.day}</p>
                        <Cloud size={21} className="forecast-icon-accent" />
                        <p className="forecast-week-value">{day.pm25}</p>
                      </div>
                    ))}
                  </div>

                  <div className="forecast-chart-row">
                    {dailyPrediction.map((day) => (
                      <div key={day.date} className="forecast-chart-column">
                        <div
                          className="forecast-chart-bar"
                          style={{ height: `${Math.max(16, day.pm25 * 1.5)}px` }}
                        />
                        <div className="forecast-chart-dot" />
                      </div>
                    ))}
                  </div>

                  <p className="forecast-updated-at">
                    Last predicted: {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

        </section>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
