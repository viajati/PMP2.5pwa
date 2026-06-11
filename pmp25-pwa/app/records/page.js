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
import { fetchRoute, estimateRoutePmLoad } from "@/lib/routePlanner";

const RoutePreviewMap = dynamic(() => import("@/components/RoutePreviewMap"), { ssr: false });

const tabs = ["LIVE", "PLANNER", "FORECAST"];
const regions = ["NORTH", "WEST", "SOUTH", "EAST"];
const ADVICE_CACHE_PREFIX = "pmp25_health_advice_v2";
const AI_ADVICE_CLIENT_CACHE_MS = 10 * 60 * 1000;
const FALLBACK_ADVICE_CLIENT_CACHE_MS = 60 * 1000;

function numericValue(value) {
  if (value === null || value === undefined || value === "" || value === "-") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numericOrZero(value) {
  return numericValue(value) ?? 0;
}

function displayNumber(value, digits = 1) {
  const number = numericValue(value);
  return number === null ? "-" : number.toFixed(digits);
}

function displayInteger(value) {
  const number = numericValue(value);
  return number === null ? "-" : String(Math.round(number));
}

function displayWithUnit(value, unit, digits = 0) {
  const text = digits === 0 ? displayInteger(value) : displayNumber(value, digits);
  return text === "-" ? "-" : `${text}${unit}`;
}

function pmColor(value) {
  const number = numericValue(value);

  if (number === null) return "#8E8E93";
  if (number <= 15.4) return "#34C759";
  if (number <= 35.4) return "#FFCC00";
  if (number <= 54.4) return "#FF9500";
  return "#FF3B30";
}

function caqiFrom(pm25, pm10, co) {
  const pm25Score = Math.min(100, (numericOrZero(pm25) / 75) * 100);
  const pm10Score = Math.min(100, (numericOrZero(pm10) / 150) * 100);
  const coScore = Math.min(100, (numericOrZero(co) / 2000) * 100);
  return Math.round(Math.max(pm25Score, pm10Score, coScore));
}

function getWeatherMeta(rawCode, rawWindSpeed = 0) {
  const code = numericValue(rawCode);
  const windSpeed = numericValue(rawWindSpeed);

  if (windSpeed !== null && windSpeed >= 28) return { Icon: Wind, label: "windy", type: "windy" };
  if ([95, 96, 99].includes(code)) return { Icon: CloudLightning, label: "stormy", type: "storm" };
  if ([
    51, 53, 55, 56, 57,
    61, 63, 65, 66, 67,
    71, 73, 75, 77,
    80, 81, 82, 85, 86,
  ].includes(code)) return { Icon: CloudRain, label: "rainy", type: "rain" };
  if ([45, 48].includes(code)) return { Icon: CloudFog, label: "foggy", type: "cloudy" };
  if (code === 3) return { Icon: Cloud, label: "cloudy", type: "cloudy" };
  if (code === 2) return { Icon: CloudSun, label: "partly cloudy", type: "partly" };
  if (code === 1) return { Icon: CloudSun, label: "mostly sunny", type: "partly" };
  return { Icon: Sun, label: "sunny", type: "sunny" };
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
    pm25: null,
    pm10: null,
    co: null,
    temp: null,
    humidity: null,
    windSpeed: null,
    weatherCode: null,
    time: null,
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

function normalizeWeatherBackgroundType(type) {
  if (type === "rain") return "raining";
  return type;
}

function geminiFallbackReason(error = "", t) {
  const message = String(error || "").toLowerCase();

  if (!message) return "";
  if (message.includes("quota")) {
    return t(
      "Gemini quota limit reached. Using profile rules until quota resets.",
      "Gemini 額度已達上限，額度重置前會使用健康設定規則。"
    );
  }
  if (message.includes("api_key") || message.includes("key")) {
    return t(
      "Gemini key is not available in this deployment. Using profile rules.",
      "此部署未取得 Gemini 金鑰，會使用健康設定規則。"
    );
  }
  if (message.includes("model")) {
    return t(
      "Gemini model is unavailable. Check GEMINI_MODEL in Vercel.",
      "Gemini 模型不可用，請檢查 Vercel 的 GEMINI_MODEL。"
    );
  }

  return t(
    "Gemini is temporarily unavailable. Using profile rules.",
    "Gemini 暫時不可用，會使用健康設定規則。"
  );
}

function roundedCacheNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(1)) : fallback;
}

function openMeteoFetchLabel(row, t) {
  if (!row) return t("Open-Meteo PM2.5", "Open-Meteo PM2.5");

  const time = (row.time || t("Now", "現在")).split(" ")[1] || row.time || t("Now", "現在");
  const zone = row.timezoneAbbreviation || "GMT+8";
  const hasGrid = Number.isFinite(Number(row.apiLatitude)) && Number.isFinite(Number(row.apiLongitude));
  const grid = hasGrid
    ? ` · ${t("Grid", "網格")} ${Number(row.apiLatitude).toFixed(2)}°N ${Number(row.apiLongitude).toFixed(2)}°E`
    : "";

  return `${t("Open-Meteo PM2.5", "Open-Meteo PM2.5")} · ${t("Fetch", "更新")}: ${time} ${zone}${grid}`;
}

function readAdviceCache(key) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached?.value || Date.now() > Number(cached.expiresAt || 0)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return cached.value;
  } catch {
    return null;
  }
}

function writeAdviceCache(key, value, ttl) {
  if (typeof window === "undefined" || !value) return;

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        value,
        expiresAt: Date.now() + ttl,
      })
    );
  } catch {
    // Ignore storage quota/private-mode failures; the API route still has a cache.
  }
}

function RingGauge({ value, label, subLabel, color = "#FFCC00" }) {
  const number = numericValue(value);
  const clamped = number === null ? 0 : Math.max(1, Math.min(100, number));

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
          <p>{number === null ? "-" : `${Math.round(clamped)}%`}</p>
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
  const [adviceResolved, setAdviceResolved] = useState(false);

  const [startCity, setStartCity] = useState("Taipei City");
  const [endCity, setEndCity] = useState("Hsinchu City");
  const [transport, setTransport] = useState("car");
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [dailyPrediction, setDailyPrediction] = useState([]);

  async function loadData() {
    setLoading(true);

    try {
      const [liveResult, hourlyResult] = await Promise.allSettled([
        fetchAllCityAirQuality(),
        fetchHourlyAirQuality(city, 7),
      ]);

      if (liveResult.status === "fulfilled" && liveResult.value?.length) {
        setRows(liveResult.value);
      } else if (liveResult.status === "rejected") {
        console.warn("Live records load failed:", liveResult.reason);
      }

      if (hourlyResult.status === "fulfilled") {
        setDailyPrediction(buildDailyPrediction(hourlyResult.value));
      } else {
        console.warn("Forecast records load failed:", hourlyResult.reason);
      }
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
  const selectedPm25 = numericValue(selected?.pm25);
  const selectedPm10 = numericValue(selected?.pm10);
  const selectedCo = numericValue(selected?.co);
  const selectedHumidity = numericValue(selected?.humidity);
  const selectedWindSpeed = numericValue(selected?.windSpeed);
  const selectedWeatherCode = numericValue(selected?.weatherCode);
  const currentHour = new Date().getHours();
  const weather = getWeatherMeta(selectedWeatherCode, selectedWindSpeed);
  const WeatherIcon = weather.Icon;
  const hasSelectedAirData = selectedPm25 !== null || selectedPm10 !== null || selectedCo !== null;
  const caqi = caqiFrom(selectedPm25, selectedPm10, selectedCo);
  const liveWeather = {
    type: normalizeWeatherBackgroundType(weather.type),
    weatherCode: selectedWeatherCode ?? 0,
    windSpeed: selectedWindSpeed ?? 0,
  };
  const pollutionScore = selectedPm25 === null ? null : Math.max(0, Math.min(100, 100 - (selectedPm25 * 1.5)));
  const healthProfileKey = JSON.stringify(healthProfile);
  const fallbackHealthAdvice = useMemo(() => (
    buildHealthAdvice({
      city: cityName(city, isChinese),
      pm25: selectedPm25 ?? 0,
      weatherLabel: weatherName(weather.label, isChinese),
      weatherType: weather.type,
      profile: healthProfile,
      chinese: isChinese,
    })
  ), [city, healthProfile, isChinese, selectedPm25, weather.label, weather.type]);
  const healthAdvice = aiHealthAdvice || fallbackHealthAdvice;

  useEffect(() => {
    if (selectedPm25 === null) {
      queueMicrotask(() => {
        setAiHealthAdvice(null);
        setAdviceLoading(false);
        setAdviceResolved(false);
      });
      return undefined;
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setAdviceLoading(true);
        setAdviceResolved(false);
      }
    });

    const adviceRequest = {
      language: isChinese ? "zh-TW" : "en",
      city,
      displayCity: cityName(city, isChinese),
      air: {
        pm25: selectedPm25,
        pm10: selectedPm10 ?? 0,
        co: selectedCo ?? 0,
        caqi,
        temp: selected?.temp ?? "",
        humidity: selectedHumidity ?? "",
        windSpeed: selectedWindSpeed ?? "",
        weather: weather.label,
        weatherType: weather.type,
      },
      profile: healthProfile,
    };
    const adviceCacheKey = `${ADVICE_CACHE_PREFIX}:${JSON.stringify({
      language: adviceRequest.language,
      city: adviceRequest.city,
      displayCity: adviceRequest.displayCity,
      pm25: roundedCacheNumber(adviceRequest.air.pm25),
      pm10: roundedCacheNumber(adviceRequest.air.pm10),
      co: roundedCacheNumber(adviceRequest.air.co),
      humidity: roundedCacheNumber(adviceRequest.air.humidity),
      windSpeed: roundedCacheNumber(adviceRequest.air.windSpeed),
      weather: adviceRequest.air.weather,
      weatherType: adviceRequest.air.weatherType,
      profile: healthProfile,
    })}`;
    const cachedAdvice = readAdviceCache(adviceCacheKey);

    if (cachedAdvice) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setAiHealthAdvice(cachedAdvice);
          setAdviceLoading(false);
          setAdviceResolved(true);
        }
      });
      return () => controller.abort();
    }

    fetch("/api/health-advice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(adviceRequest),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("AI advice unavailable");
        return response.json();
      })
      .then((advice) => {
        if (advice?.providerError) {
          console.warn("[Records] Gemini advice fallback:", advice.providerError);
        }

        setAiHealthAdvice(advice);
        setAdviceResolved(true);

        if (advice?.source === "ai") {
          writeAdviceCache(adviceCacheKey, advice, AI_ADVICE_CLIENT_CACHE_MS);
        } else if (String(advice?.providerError || "").toLowerCase().includes("quota")) {
          writeAdviceCache(adviceCacheKey, advice, FALLBACK_ADVICE_CLIENT_CACHE_MS);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("[Records] AI advice request failed:", error.message);
          setAiHealthAdvice(null);
          setAdviceResolved(true);
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
    selectedCo,
    selectedHumidity,
    selectedPm10,
    selectedPm25,
    selected?.temp,
    selectedWindSpeed,
    weather.label,
    weather.type,
  ]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => item.region === region);
  }, [rows, region]);

  const tomorrow = dailyPrediction[1] || dailyPrediction[0] || {};
  const tomorrowPm25 = numericValue(tomorrow.pm25);
  const tomorrowPm10 = numericValue(tomorrow.pm10);
  const tomorrowCo = numericValue(tomorrow.co);
  const drift = selectedPm25 !== null && tomorrowPm25 !== null
    ? Number((tomorrowPm25 - selectedPm25).toFixed(1))
    : null;
  const actualScore = selectedPm25 === null
    ? null
    : Math.max(1, Math.min(100, 100 - (selectedPm25 * 1.1)));
  const potentialBasis = tomorrowPm25 ?? selectedPm25;
  const potentialScore = potentialBasis === null
    ? null
    : Math.max(1, Math.min(100, 100 - (potentialBasis * 1.1)));
  const forecastTrendValues = [
    selectedPm25,
    ...dailyPrediction.slice(0, 6).map((day) => numericValue(day.pm25)),
  ];
  const forecastChartValues = forecastTrendValues.filter((value) => value !== null);
  const hasForecastTrendData = forecastChartValues.length > 0;
  const forecastMax = Math.max(1, ...forecastChartValues) * 1.6;
  const forecastLinePoints = forecastTrendValues.map((value, index) => {
    if (value === null) return null;

    const x = 15 + (index / 6) * 300;
    const y = 15 + (100 - ((value / forecastMax) * 100));
    return `${x},${y}`;
  }).filter(Boolean).join(" ");

  const routeKm = distanceBetween(startCity, endCity);
  const routeMinutes = routeMinutesFor(transport, routeKm);

  const destination = rows.find((item) => item.county === endCity) || selected;
  const destinationPm25 = numericValue(destination?.pm25);
  const avgRoutePm25 = selectedPm25 !== null && destinationPm25 !== null
    ? Number(((selectedPm25 + destinationPm25) / 2).toFixed(1))
    : null;
  const routeLoad = avgRoutePm25 === null ? null : estimateRoutePmLoad(avgRoutePm25);
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

  const pageTitle = mode === "LIVE"
    ? t("Records", "紀錄")
    : mode === "PLANNER"
      ? t("Planner", "規劃")
      : t("Forecast", "預測");
  const pageKicker = mode === "LIVE"
    ? t("Archive", "檔案")
    : mode === "PLANNER"
      ? t("Route", "路線")
      : t("Air outlook", "空氣趨勢");

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
      ? drift === null
        ? t("Trend: waiting for PM2.5 forecast data.", "趨勢：等待 PM2.5 預測資料。")
        : `${t("Trend", "趨勢")}：${drift > 0 ? t("PM2.5 may increase tomorrow.", "明天 PM2.5 可能上升。") : t("Stable or lower PM2.5 expected tomorrow.", "明天 PM2.5 預期持平或下降。")}`
      : routeData
        ? `${cityName(startCity, isChinese)} → ${cityName(endCity, isChinese)} · ${displayedDistance.toFixed(1)} KM · ${Math.round(displayedDuration)} ${t("min", "分鐘")} · ${displayNumber(displayedLoad, 1)} µg/m³`
      : t("Pick origin, destination, and transport to optimize exposure along the route.", "選擇起點、目的地與交通方式來優化路線暴露。");
  const adviceSourceLabel = healthAdvice.source === "ai"
    ? t("Gemini profile advice", "Gemini 個人化建議")
    : t("Profile-based advice", "健康設定建議");
  const adviceFallbackReason = healthAdvice.source !== "ai"
    ? geminiFallbackReason(healthAdvice.providerError, t)
    : "";
  const airDataWaiting = selectedPm25 === null;
  const advicePending = airDataWaiting || adviceLoading || !adviceResolved;

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
      const load = avgRoutePm25 === null ? null : estimateRoutePmLoad(avgRoutePm25);

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

              <div className="records-native-page-header records-native-page-header-overlay">
                <div>
                  <p className="screen-kicker">{pageKicker}</p>
                  <h1 className="app-page-title">{pageTitle}</h1>
                </div>

                <button
                  onClick={loadData}
                  className="records-native-refresh"
                  title={t("Refresh records", "重新整理紀錄")}
                >
                  <RefreshCw size={20} strokeWidth={3} className={loading ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="records-weather-content">
                <p className="records-weather-city">
                  {cityName(city, isChinese).toUpperCase()}
                </p>

                <p className="records-weather-temp records-weather-pm25">
                  {displayNumber(selectedPm25, 1)}
                  <span>PM2.5</span>
                </p>

                <div className="records-weather-condition">
                  <WeatherIcon size={24} strokeWidth={2.8} />
                  <span>{airDataWaiting ? t("Loading", "載入中") : weather.type === "sunny" ? t("Good", "良好") : weatherName(weather.label, isChinese)}</span>
                </div>

                <div className="records-weather-bubbles">
                  <div className="records-weather-bubble records-weather-bubble-pollution">
                    <p>{t("Pollution", "污染")}</p>
                    <strong>{pollutionScore === null ? "-" : `${Math.round(pollutionScore)}%`}</strong>
                  </div>

                  <div className="records-weather-bubble records-weather-bubble-wind">
                    <p>{t("Wind", "風速")}</p>
                    <strong>{displayWithUnit(selectedWindSpeed, "km", 1)}</strong>
                  </div>

                  <div className="records-weather-bubble records-weather-bubble-humidity">
                    <p>{t("Humidity", "濕度")}</p>
                    <strong>{displayWithUnit(selectedHumidity, "%")}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={[
            "records-native-content",
            mode === "LIVE" ? "records-native-content-live" : "",
          ].join(" ")}>
            {mode !== "LIVE" && (
              <div className="records-native-page-header records-native-page-header-standard">
                <div>
                  <p className="screen-kicker">{pageKicker}</p>
                  <h1 className="app-page-title">{pageTitle}</h1>
                </div>

                <button
                  onClick={loadData}
                  className="records-native-refresh records-native-refresh-standard"
                  title={t("Refresh records", "重新整理紀錄")}
                >
                  <RefreshCw size={20} strokeWidth={3} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            )}

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

            <div className={["records2-advice", "records-native-ai", mode === "LIVE" ? `records-health-advice records-health-advice-${healthAdvice.level}` : ""].join(" ")}>
              <span className="records-native-ai-glow" />
              {mode === "PLANNER" ? (
                <Route size={16} className="app-notice-icon" />
              ) : (
                <Sparkles size={16} className="app-notice-icon" />
              )}

              {mode === "LIVE" ? (
                <div className="records-advice-copy">
                  <div className="records-advice-head">
                    <p className="records-advice-kicker">
                      {airDataWaiting ? t("Loading PM2.5", "載入 PM2.5") : advicePending ? t("Personalizing", "個人化中") : adviceSourceLabel}
                    </p>
                    <span className="records-advice-pill">
                      {advicePending ? t("WAITING", "等待中") : healthAdvice.label}
                    </span>
                  </div>

                  <p className="records-advice-title">
                    {airDataWaiting ? t("Waiting for PM2.5 readings...", "等待 PM2.5 讀數...") : advicePending ? t("Reading your profile...", "正在讀取你的健康設定...") : healthAdvice.title}
                  </p>

                  <p className="records-advice-summary">
                    {airDataWaiting ? t("Records will update when the PM2.5 API responds.", "PM2.5 API 回應後會更新紀錄。") : advicePending ? t("Combining PM2.5, weather, and your health profile.", "正在結合 PM2.5、天氣與你的健康設定。") : healthAdvice.summary}
                  </p>

                  {!advicePending && healthAdvice.actions?.length > 0 && (
                    <ul className="records-advice-list">
                      {healthAdvice.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  )}

                  {!advicePending && adviceFallbackReason && (
                    <p className="records-advice-status">
                      {adviceFallbackReason}
                    </p>
                  )}
                </div>
              ) : (
                <p className="records-native-ai-text">
                  {globalAdviceText}
                </p>
              )}
            </div>

            {mode === "LIVE" && (
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
                    : openMeteoFetchLabel(selected, t)}
                </p>
              </div>

              <div className="records-list">
                {filteredRows.map((item) => {
                  const meta = getWeatherMeta(item.weatherCode, item.windSpeed);
                  const Icon = meta.Icon;
                  const active = item.county === city;
                  const itemWeatherWaiting = numericValue(item.weatherCode) === null
                    && numericValue(item.windSpeed) === null;

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
                          {itemWeatherWaiting ? t("Loading", "載入中") : weatherName(meta.label, isChinese)} · {t("Hum", "濕度")} {displayWithUnit(item.humidity, "%")} · {t("Wind", "風速")} {displayWithUnit(item.windSpeed, " km/h", 1)}
                        </p>
                      </div>

                      <p className="records-row-value">
                        {displayNumber(item.pm25, 1)}
                        <span className="records-row-unit">µg/m³ PM2.5</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "PLANNER" && (
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
                      {displayNumber(avgRoutePm25, 1)}
                      <span className="records2-unit">µg/m³</span>
                    </p>
                  </div>

                  <div className="records2-soft records-metric-span">
                    <p className="records2-label">{t("Route PM Avg", "路線 PM 平均")}</p>
                    <p
                      className="records2-value records2-value-md"
                      style={{ "--value-color": pmColor(avgRoutePm25) }}
                    >
                      {displayNumber(displayedLoad, 1)}
                      <span className="records2-unit">µg/m³</span>
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
            </>
          )}

          {mode === "FORECAST" && (
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
                    <p className="forecast-native-caqi-num">{hasSelectedAirData ? caqi : "-"}</p>
                    <p className="forecast-native-caqi-label">CAQI</p>
                  </div>

                  <div className="forecast-native-hero-copy">
                    <span className="forecast-native-status-pill">
                      {!hasSelectedAirData ? t("LOADING", "載入中") : caqi < 35 ? t("HEALTHY", "健康") : t("MODERATE", "普通")}
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
                    subLabel={actualScore === null ? "-" : actualScore > 60 ? t("Good", "良好") : t("Poor", "不佳")}
                    color={actualScore === null ? "#8E8E93" : actualScore > 60 ? "#FFCC00" : "#FF3B30"}
                  />
                  <span className="forecast-native-gauge-arrow">→</span>
                  <RingGauge
                    value={potentialScore}
                    label={t("Predicted (Tom.)", "明日預測")}
                    subLabel={potentialScore === null ? "-" : potentialScore > 60 ? t("Good", "良好") : t("Poor", "不佳")}
                    color={potentialScore === null ? "#8E8E93" : potentialScore > 60 ? "#FF9500" : "#FF3B30"}
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
                        {displayInteger(selectedPm25)}
                      </p>
                      <Sun size={18} className="forecast-icon-good" />
                    </div>
                  </div>

                  <div className="forecast-metric-card">
                    <p className="forecast-metric-title">PM10</p>
                    <p className="forecast-metric-sub">{t("Coarse particles", "粗懸浮微粒")}</p>

                    <div className="forecast-metric-row">
                      <p className="forecast-metric-value forecast-metric-warn">
                        {displayInteger(selectedPm10)}
                      </p>
                      <Cloud size={18} className="forecast-icon-warn" />
                    </div>
                  </div>

                  <div className="forecast-metric-card">
                    <p className="forecast-metric-title">CO</p>
                    <p className="forecast-metric-sub">{t("Carbon monoxide", "一氧化碳")}</p>

                    <div className="forecast-metric-row">
                      <p className="forecast-metric-value forecast-metric-good">
                        {displayInteger(selectedCo)}
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
                    <p className="forecast-future-value">{displayNumber(tomorrowPm25, 1)}</p>
                    <p className="forecast-future-label">PM 2.5</p>
                  </div>

                  <div className="forecast-future-cell">
                    <TrendingUp size={20} className="forecast-icon-muted" />
                    <p className="forecast-future-value">{displayNumber(tomorrowPm10, 1)}</p>
                    <p className="forecast-future-label">PM 10</p>
                  </div>

                  <div className="forecast-future-cell">
                    <Leaf size={20} className="forecast-icon-muted" />
                    <p className="forecast-future-value">{displayInteger(tomorrowCo)}</p>
                    <p className="forecast-future-label">CO2 / CO</p>
                  </div>

                  <div className="forecast-future-cell">
                    <Navigation size={20} className="forecast-icon-muted" />
                    <p
                      className="forecast-future-value"
                      style={{ "--value-color": drift === null ? "#8E8E93" : drift <= 0 ? "#34C759" : "#FF3B30" }}
                    >
                      {drift === null ? "-" : drift}
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
                        <p className="forecast-week-value">{displayInteger(day.pm25)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="forecast-native-chart-box">
                    {hasForecastTrendData ? (
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
                          if (value === null) return null;

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
                    ) : (
                      <p className="forecast-updated-at">
                        {t("Waiting for PM2.5 forecast data.", "等待 PM2.5 預測資料。")}
                      </p>
                    )}
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
