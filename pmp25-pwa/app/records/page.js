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
import WeatherBackground from "@/components/WeatherBackground";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { useAuth } from "@/components/AuthProvider";
import { CITY_COORDS, REGIONS } from "@/lib/cities";
import { WEEKDAY_ZH, cityName, regionName, weatherName } from "@/lib/i18n";
import { subscribeHealthProfile } from "@/lib/firebaseData";
import { buildHealthAdvice } from "@/lib/healthAdvice";
import {
  DEFAULT_HEALTH_PROFILE,
  cleanHealthProfile,
  loadLocalHealthProfile,
} from "@/lib/healthProfile";
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

function normalizeWeatherBackgroundType(type) {
  if (type === "rain") return "raining";
  return type;
}

function RingGauge({ value, label, subLabel, color = "#FFCC00" }) {
  const clamped = Math.max(1, Math.min(100, Number(value) || 0));

  return (
    <div className="forecast-native-ring-item">
      <div
        className="forecast-native-ring"
        style={{
          "--gauge-degrees": `${clamped * 3.6}deg`,
          "--gauge-color": color,
        }}
      >
        <div className="forecast-native-ring-center">
          <p>{Math.round(clamped)}%</p>
          <span>{subLabel}</span>
        </div>
      </div>
      <p className="forecast-native-ring-label">{label}</p>
    </div>
  );
}

export default function RecordsPage() {
  const { prefs, t } = useAppPreferences();
  const { user, firebaseReady } = useAuth();
  const isChinese = prefs.chinese;
  const [mode, setMode] = useState("LIVE");
  const [region, setRegion] = useState("NORTH");
  const [city, setCity] = useState("Taipei City");
  const [rows, setRows] = useState(() => fallbackRows());
  const [loading, setLoading] = useState(true);
  const [healthProfile, setHealthProfile] = useState(DEFAULT_HEALTH_PROFILE);
  const [aiHealthAdvice, setAiHealthAdvice] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

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
      if (!cancelled) {
        setHealthProfile(loadLocalHealthProfile());
        loadData();
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!firebaseReady || !user?.uid) return undefined;

    return subscribeHealthProfile(
      user.uid,
      (cloudProfile) => {
        if (cloudProfile) setHealthProfile(cleanHealthProfile(cloudProfile));
      },
      (error) => {
        console.warn("Unable to load health profile for records:", error);
      }
    );
  }, [firebaseReady, user?.uid]);

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
  const weather = getWeatherMeta(selected?.weatherCode, selected?.windSpeed);
  const WeatherIcon = weather.Icon;
  const caqi = caqiFrom(selected?.pm25 || 0, selected?.pm10 || 0, selected?.co || 0);
  const liveWeather = {
    type: normalizeWeatherBackgroundType(weather.type),
    weatherCode: selected?.weatherCode || 0,
    windSpeed: selected?.windSpeed || 0,
  };
  const pollutionScore = Math.max(0, Math.min(100, 100 - ((selected?.pm25 || 0) * 1.5)));
  const currentTemp = Number(selected?.temp);
  const healthProfileKey = JSON.stringify(healthProfile);
  const fallbackHealthAdvice = useMemo(() => (
    buildHealthAdvice({
      city: cityName(city, isChinese),
      pm25: selected?.pm25 || 0,
      weatherLabel: weatherName(weather.label, isChinese),
      weatherType: weather.type,
      profile: healthProfile,
      chinese: isChinese,
    })
  ), [city, healthProfile, isChinese, selected?.pm25, weather.label, weather.type]);
  const healthAdvice = aiHealthAdvice || fallbackHealthAdvice;

  useEffect(() => {
    const pm25 = Number(selected?.pm25);

    if (!Number.isFinite(pm25) || loading) {
      queueMicrotask(() => setAiHealthAdvice(null));
      return undefined;
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setAdviceLoading(true);
    });

    fetch("/api/health-advice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: isChinese ? "zh-TW" : "en",
        city,
        displayCity: cityName(city, isChinese),
        air: {
          pm25,
          pm10: selected?.pm10 || 0,
          co: selected?.co || 0,
          caqi,
          temp: selected?.temp ?? "",
          humidity: selected?.humidity ?? "",
          windSpeed: selected?.windSpeed ?? "",
          weather: weather.label,
          weatherType: weather.type,
        },
        profile: healthProfile,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("AI advice unavailable");
        return response.json();
      })
      .then((advice) => setAiHealthAdvice(advice))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setAiHealthAdvice(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAdviceLoading(false);
      });

    return () => controller.abort();
  }, [
    caqi,
    city,
    healthProfile,
    healthProfileKey,
    isChinese,
    loading,
    selected?.co,
    selected?.humidity,
    selected?.pm10,
    selected?.pm25,
    selected?.temp,
    selected?.windSpeed,
    weather.label,
    weather.type,
  ]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => item.region === region);
  }, [rows, region]);

  const tomorrow = dailyPrediction[1] || dailyPrediction[0] || { pm25: 0, pm10: 0, co: 0 };
  const drift = Number(((tomorrow.pm25 || 0) - (selected?.pm25 || 0)).toFixed(1));
  const actualScore = Math.max(1, Math.min(100, 100 - ((selected?.pm25 || 0) * 1.1)));
  const potentialScore = Math.max(1, Math.min(100, 100 - ((tomorrow.pm25 || selected?.pm25 || 0) * 1.1)));
  const forecastTrendValues = [
    selected?.pm25 || 0,
    ...dailyPrediction.slice(0, 6).map((day) => day.pm25 || 0),
  ];
  const forecastMax = Math.max(1, ...forecastTrendValues) * 1.6;
  const forecastLinePoints = forecastTrendValues.map((value, index) => {
    const x = 15 + (index / 6) * 300;
    const y = 15 + (100 - ((value / forecastMax) * 100));
    return `${x},${y}`;
  }).join(" ");

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
    { key: "car", label: t("CAR", "開車"), icon: Car },
    { key: "bike", label: t("BIKE", "騎車"), icon: Bike },
    { key: "walk", label: t("WALK", "步行"), icon: Footprints },
  ];

  const tabLabel = {
    LIVE: t("LIVE", "即時"),
    PLANNER: t("PLANNER", "規劃"),
    FORECAST: t("FORECAST", "預測"),
  };

  const regionLabel = {
    NORTH: regionName("NORTH", isChinese),
    WEST: regionName("WEST", isChinese),
    SOUTH: regionName("SOUTH", isChinese),
    EAST: regionName("EAST", isChinese),
  };
  const cityOptions = Object.keys(CITY_COORDS);
  const globalAdviceText = mode === "LIVE"
    ? healthAdvice.summary
    : mode === "FORECAST"
      ? `${t("Trend", "趨勢")}：${drift > 0 ? t("PM2.5 may increase tomorrow.", "明天 PM2.5 可能上升。") : t("Stable or lower PM2.5 expected tomorrow.", "明天 PM2.5 預期持平或下降。")}`
      : routeData
        ? `${cityName(startCity, isChinese)} → ${cityName(endCity, isChinese)} · ${displayedDistance.toFixed(1)} KM · ${Math.round(displayedDuration)} ${t("min", "分鐘")} · ${displayedLoad} ${t("score", "分")}`
        : t("Pick origin, destination, and transport to optimize exposure along the route.", "選擇起點、目的地與交通方式來優化路線暴露。");

  function forecastDayLabel(day) {
    if (!isChinese) return day.day;
    const date = new Date(day.date);
    return WEEKDAY_ZH[date.getDay()] || day.day;
  }

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
        <section className={[
          "records-page-body",
          "records-native-body",
          mode !== "LIVE" ? "records-native-body-standard" : "",
        ].join(" ")}>
          {mode === "LIVE" && (
            <div className="records-weather-header">
              <WeatherBackground weather={liveWeather} hour={currentHour} />
              <div className="records-weather-fade" />
              <button
                onClick={loadData}
                className="records-native-refresh"
                title={t("Refresh records", "重新整理紀錄")}
              >
                <RefreshCw size={20} strokeWidth={3} className={loading ? "animate-spin" : ""} />
              </button>

              <div className="records-weather-content">
                <p className="records-weather-city">
                  {cityName(city, isChinese).toUpperCase()}
                </p>

                <p className="records-weather-temp">
                  {Number.isFinite(currentTemp) ? Math.round(currentTemp) : 0}°
                </p>

                <div className="records-weather-condition">
                  <WeatherIcon size={24} strokeWidth={2.8} />
                  <span>{weather.type === "sunny" ? t("Good", "良好") : weatherName(weather.label, isChinese)}</span>
                </div>

                <div className="records-weather-bubbles">
                  <div className="records-weather-bubble records-weather-bubble-pollution">
                    <p>{t("Pollution", "污染")}</p>
                    <strong>{Math.round(pollutionScore)}%</strong>
                  </div>

                  <div className="records-weather-bubble records-weather-bubble-wind">
                    <p>{t("Wind", "風速")}</p>
                    <strong>{selected?.windSpeed ?? 0}km</strong>
                  </div>

                  <div className="records-weather-bubble records-weather-bubble-humidity">
                    <p>{t("Humidity", "濕度")}</p>
                    <strong>{selected?.humidity ?? 0}%</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={[
            "records-native-content",
            mode === "LIVE" ? "records-native-content-live" : "",
          ].join(" ")}>
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

            <div className={["records2-advice", "records-native-ai", mode === "LIVE" ? `records-health-advice-${healthAdvice.level}` : ""].join(" ")}>
              <span className="records-native-ai-glow" />
              {mode === "PLANNER" ? (
                <Route size={16} className="app-notice-icon" />
              ) : (
                <Sparkles size={16} className="app-notice-icon" />
              )}
              <p className="records-native-ai-text">
                {adviceLoading && mode === "LIVE" ? t("Personalizing atmosphere...", "正在產生個人化空氣建議...") : globalAdviceText}
              </p>
            </div>

            {loading ? (
              <div className="records-native-loader">
                <div className="refined-loader-ring">
                  <span />
                </div>
                <p>{t("Fetching Atmosphere...", "正在取得空氣資料...").toUpperCase()}</p>
              </div>
            ) : mode === "LIVE" && (
              <>
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
                    ? t("Loading...", "載入中...")
                    : `${t("Fetch", "更新")}: ${(selected?.time || t("Now", "現在")).split(" ")[1] || selected?.time}`}
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
                          {cityName(item.county, isChinese)}
                        </p>
                        <p className="records-row-meta">
                          {weatherName(meta.label, isChinese)} · {t("Hum", "濕度")} {item.humidity ?? "-"}% · {t("Wind", "風速")} {item.windSpeed ?? "-"} km/h
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

          {!loading && mode === "PLANNER" && (
            <>
              <div className="records-form-grid records-city-picker-grid">
                <div className="records2-card records-city-picker-card">
                  <p className="records2-label">{t("Origin", "起點")}</p>
                  <div className="records-city-pick-scroll">
                    {cityOptions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setStartCity(item);
                          setRouteData(null);
                        }}
                        className={[
                          "records-city-pick-button",
                          startCity === item ? "records-city-pick-button-active" : "",
                        ].join(" ")}
                      >
                        {cityName(item, isChinese)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="records2-card records-city-picker-card">
                  <p className="records2-label">{t("Destination", "目的地")}</p>
                  <div className="records-city-pick-scroll">
                    {cityOptions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setEndCity(item);
                          setRouteData(null);
                        }}
                        className={[
                          "records-city-pick-button",
                          endCity === item ? "records-city-pick-button-active" : "",
                        ].join(" ")}
                      >
                        {cityName(item, isChinese)}
                      </button>
                    ))}
                  </div>
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
                  {routeLoading ? t("OPTIMIZING", "規劃中") : t("OPTIMIZE", "最佳化")}
                </button>
              </div>

              <div className="records2-card records-route-card">
                <div className="records-route-header">
                  <div>
                    <p className="records2-label">{t("Estimated Route", "預估路線")}</p>
                    <p className="records2-value">
                      {displayedDistance.toFixed(1)}
                      <span className="records2-unit">KM</span>
                    </p>
                  </div>

                  <Navigation size={34} strokeWidth={2.8} className="app-notice-icon" />
                </div>

                <div className="records-metric-grid">
                  <div className="records2-soft">
                    <p className="records2-label">{t("Time", "時間")}</p>
                    <p className="records2-value records2-value-sm">
                      {Math.round(displayedDuration)}
                      <span className="records2-unit">{t("min", "分鐘")}</span>
                    </p>
                  </div>

                  <div className="records2-soft">
                    <p className="records2-label">{t("Avg PM2.5", "平均 PM2.5")}</p>
                    <p className="records2-value records2-value-sm">
                      {avgRoutePm25}
                      <span className="records2-unit">µg/m³</span>
                    </p>
                  </div>

                  <div className="records2-soft records-metric-span">
                    <p className="records2-label">{t("Exposure Load", "暴露負荷")}</p>
                    <p
                      className="records2-value records2-value-md"
                      style={{ "--value-color": pmColor(avgRoutePm25) }}
                    >
                      {displayedLoad}
                      <span className="records2-unit">{t("score", "分")}</span>
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
                {t(
                  "Blue marker = origin. Red marker = destination. Cyan line = calculated route. Avg PM2.5 is applied over travel time, then adjusted by transport exposure rate.",
                  "藍色標記代表起點，紅色標記代表目的地，青色線條代表計算路線。平均 PM2.5 會套用到旅行時間，再依交通暴露率調整。"
                )}
              </p>
            </>
          )}

          {!loading && mode === "FORECAST" && (
            <div className="forecast-shell forecast-native-shell">
              <div className="forecast-native-header-row">
                <p className="forecast-native-header-title">{t("CITY PREDICTION", "城市預測")}</p>
                <div className="forecast-native-time-pill">
                  <span />
                  {(selected?.time || "Now").split(" ")[1] || selected?.time || "Now"}
                </div>
              </div>

              <div className="forecast-native-region-row">
                {regions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRegion(item)}
                    className={[
                      "forecast-native-region-button",
                      region === item ? "forecast-native-region-active" : "",
                    ].join(" ")}
                  >
                    {regionLabel[item]}
                  </button>
                ))}
              </div>

              <div className="forecast-native-city-scroll">
                {(REGIONS[region] || []).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCity(item)}
                    className={[
                      "forecast-native-city-chip",
                      city === item ? "forecast-native-city-chip-active" : "",
                    ].join(" ")}
                  >
                    {cityName(item, isChinese)}
                  </button>
                ))}
              </div>

              <div className="forecast-native-pill-card">
                <span className="forecast-native-bubble forecast-native-bubble-a" />
                <span className="forecast-native-bubble forecast-native-bubble-b" />
                <span className="forecast-native-bubble forecast-native-bubble-c" />

                <div className="forecast-native-hero-row">
                  <div className="forecast-native-caqi-box">
                    <p className="forecast-native-caqi-num">{caqi}</p>
                    <p className="forecast-native-caqi-label">CAQI</p>
                  </div>

                  <div className="forecast-native-hero-copy">
                    <span className="forecast-native-status-pill">
                      {caqi < 35 ? t("HEALTHY", "健康") : t("MODERATE", "普通")}
                    </span>
                  </div>
                </div>

                <div className="forecast-native-track-row">
                  <p>{t("Track Score", "追蹤分數")}</p>
                  <span />
                </div>

                <div className="forecast-native-gauge-row">
                  <RingGauge
                    value={actualScore}
                    label={t("Actual (Now)", "目前實測")}
                    subLabel={actualScore > 60 ? t("Good", "良好") : t("Poor", "不佳")}
                    color={actualScore > 60 ? "#FFCC00" : "#FF3B30"}
                  />
                  <span className="forecast-native-gauge-arrow">→</span>
                  <RingGauge
                    value={potentialScore}
                    label={t("Predicted (Tom.)", "明日預測")}
                    subLabel={potentialScore > 60 ? t("Good", "良好") : t("Poor", "不佳")}
                    color={potentialScore > 60 ? "#FF9500" : "#FF3B30"}
                  />
                </div>
              </div>

              <div className="forecast-section">
                <h2 className="forecast-section-title">{t("Live Metrics (Right Now)", "實時數據 (現在)")}</h2>

                <div className="forecast-metrics-grid forecast-native-metrics-grid">
                  <div className="forecast-metric-card">
                    <p className="forecast-metric-title">PM2.5</p>
                    <p className="forecast-metric-sub">{t("Fine particles", "細懸浮微粒")}</p>

                    <div className="forecast-metric-row">
                      <p className="forecast-metric-value forecast-metric-good">
                        {Math.round(selected?.pm25 || 0)}
                      </p>
                      <Sun size={18} className="forecast-icon-good" />
                    </div>
                  </div>

                  <div className="forecast-metric-card">
                    <p className="forecast-metric-title">PM10</p>
                    <p className="forecast-metric-sub">{t("Coarse particles", "粗懸浮微粒")}</p>

                    <div className="forecast-metric-row">
                      <p className="forecast-metric-value forecast-metric-warn">
                        {Math.round(selected?.pm10 || 0)}
                      </p>
                      <Cloud size={18} className="forecast-icon-warn" />
                    </div>
                  </div>

                  <div className="forecast-metric-card">
                    <p className="forecast-metric-title">CO</p>
                    <p className="forecast-metric-sub">{t("Carbon monoxide", "一氧化碳")}</p>

                    <div className="forecast-metric-row">
                      <p className="forecast-metric-value forecast-metric-good">
                        {Math.round(selected?.co || 0)}
                      </p>
                      <Leaf size={18} className="forecast-icon-good" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="forecast-section">
                <h2 className="forecast-section-title">{t("Future Scope (Tomorrow's Prediction)", "未來局勢 (24小時預測)")}</h2>

                <div className="forecast-future-grid forecast-native-future-grid">
                  <div className="forecast-future-cell">
                    <Cloud size={20} className="forecast-icon-muted" />
                    <p className="forecast-future-value">{Number(tomorrow.pm25 || 0).toFixed(1)}</p>
                    <p className="forecast-future-label">PM 2.5</p>
                  </div>

                  <div className="forecast-future-cell">
                    <TrendingUp size={20} className="forecast-icon-muted" />
                    <p className="forecast-future-value">{Number(tomorrow.pm10 || 0).toFixed(1)}</p>
                    <p className="forecast-future-label">PM 10</p>
                  </div>

                  <div className="forecast-future-cell">
                    <Leaf size={20} className="forecast-icon-muted" />
                    <p className="forecast-future-value">{Math.round(tomorrow.co || 0)}</p>
                    <p className="forecast-future-label">CO2 / CO</p>
                  </div>

                  <div className="forecast-future-cell">
                    <Navigation size={20} className="forecast-icon-muted" />
                    <p
                      className="forecast-future-value"
                      style={{ "--value-color": drift <= 0 ? "#34C759" : "#FF3B30" }}
                    >
                      {drift}
                    </p>
                    <p className="forecast-future-label">{t("Drift", "變化")}</p>
                  </div>
                </div>
              </div>

              <div className="forecast-section">
                <h2 className="forecast-section-title">{t("7-Day Prediction Outlook (PM2.5)", "7天預測統計")}</h2>

                <div className="forecast-week-card forecast-native-week-card">
                  <div className="forecast-week-row">
                    {dailyPrediction.map((day) => (
                      <div key={day.date}>
                        <p className="forecast-week-day">{forecastDayLabel(day)}</p>
                        <Cloud size={20} className="forecast-icon-accent" />
                        <p className="forecast-week-value">{Math.round(day.pm25)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="forecast-native-chart-box">
                    <svg viewBox="0 0 330 140" role="img" aria-label={t("PM2.5 forecast trend", "PM2.5 預測趨勢")}>
                      {forecastTrendValues.map((_, index) => {
                        const x = 15 + (index / 6) * 300;
                        return (
                          <line
                            key={`grid-${index}`}
                            x1={x}
                            y1="10"
                            x2={x}
                            y2="130"
                            className="forecast-native-chart-grid"
                          />
                        );
                      })}
                      <polyline
                        points={forecastLinePoints}
                        fill="none"
                        className="forecast-native-chart-line"
                      />
                      {forecastTrendValues.map((value, index) => {
                        const x = 15 + (index / 6) * 300;
                        const y = 15 + (100 - ((value / forecastMax) * 100));
                        return (
                          <circle
                            key={`point-${index}`}
                            cx={x}
                            cy={y}
                            r={index === forecastTrendValues.length - 1 ? 5 : 4}
                            className="forecast-native-chart-dot"
                          />
                        );
                      })}
                    </svg>
                  </div>

                  <p className="forecast-updated-at">
                    {t("Last predicted", "最後預測")}：{selected?.time || t("Fresh", "最新")}
                  </p>
                </div>
              </div>
            </div>
          )}

          </div>
        </section>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
