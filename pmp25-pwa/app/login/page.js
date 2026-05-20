"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Languages, Moon, Sun } from "lucide-react";
import { CITY_COORDS, getNearestCity } from "@/lib/cities";
import { fetchWeatherByCoords, weatherText } from "@/lib/webWeather";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { cityName as localizedCityName, localDateString } from "@/lib/i18n";

function getTimeString(date) {
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getDateString(date, chinese) {
  return localDateString(date, chinese);
}

function splitWeatherLine(line) {
  const words = line.replace(".", "").split(" ");

  if (words.length <= 4) return [line];

  return [
    words.slice(0, 2).join(" "),
    words.slice(2, 5).join(" "),
    words.slice(5).join(" ") + ".",
  ];
}

function weatherSceneType(type) {
  if (type === "raining") return "rain";
  if (type === "storm") return "storm";
  if (type === "windy") return "windy";
  if (type === "cloudy") return "cloudy";
  if (type === "partly") return "partly";
  return "sunny";
}

export default function LoginPage() {
  const { prefs, updatePrefs, t } = useAppPreferences();
  const isChinese = prefs.chinese;
  const [isLogin, setIsLogin] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);

  const [cityName, setCityName] = useState("Hsinchu City");
  const [weatherType, setWeatherType] = useState("sunny");

  useEffect(() => {
    const firstTick = window.setTimeout(() => {
      setMounted(true);
      setCurrentTime(new Date());
    }, 0);

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    async function loadWeather(latitude, longitude, city) {
      try {
        const weather = await fetchWeatherByCoords(latitude, longitude);
        setCityName(city);
        setWeatherType(weather.type);
      } catch {
        setCityName(city);
        setWeatherType("sunny");
      }
    }

    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get("city");

    if (cityParam && CITY_COORDS[cityParam]) {
      const coords = CITY_COORDS[cityParam];
      loadWeather(coords.latitude, coords.longitude, cityParam);
      return;
    }

    if (!navigator.geolocation) {
      const fallback = CITY_COORDS["Hsinchu City"];
      loadWeather(fallback.latitude, fallback.longitude, "Hsinchu City");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const nearestCity = getNearestCity(latitude, longitude);
        loadWeather(latitude, longitude, nearestCity);
      },
      () => {
        const fallback = CITY_COORDS["Hsinchu City"];
        loadWeather(fallback.latitude, fallback.longitude, "Hsinchu City");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      }
    );
  }, []);

  const displayCityName = localizedCityName(cityName, isChinese);
  const weatherLines = splitWeatherLine(weatherText(weatherType, cityName, isChinese));
  const weatherTime =
    currentTime && (currentTime.getHours() >= 18 || currentTime.getHours() < 6)
      ? "night"
      : "day";
  const weatherSceneClass = `login-weather-scene records2-weather-${weatherSceneType(weatherType)}-${weatherTime}`;

  function handleSocialLogin(provider) {
    window.alert(t(`${provider} login will be available soon.`, `${provider} 登入即將推出。`));
  }

  return (
    <main className="app-root">
      <div className="login-frame">
        <div className={weatherSceneClass} />
        <div className="login-content">
          <section className="login-hero">
            <div className="login-preference-bar">
              <button
                type="button"
                onClick={() => updatePrefs({ chinese: !prefs.chinese })}
                className="login-preference-button"
                title={isChinese ? "Switch to English" : "切換繁體中文"}
              >
                <Languages size={16} strokeWidth={2.8} />
                {isChinese ? "中文" : "EN"}
              </button>

              <button
                type="button"
                onClick={() => updatePrefs({ darkMode: !prefs.darkMode })}
                className="login-preference-button"
                title={prefs.darkMode ? t("Switch to light mode", "切換淺色模式") : t("Switch to dark mode", "切換深色模式")}
              >
                {prefs.darkMode ? (
                  <Moon size={16} strokeWidth={2.8} />
                ) : (
                  <Sun size={16} strokeWidth={2.8} />
                )}
                {prefs.darkMode ? t("Dark", "深色") : t("Light", "淺色")}
              </button>
            </div>

            <h1 className="login-headline">
              {weatherLines.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </h1>

            <div className="login-rule" />

            <div className="login-time-row">
              <div>
                <p className="login-time">
                  {mounted && currentTime ? getTimeString(currentTime) : "--:--:--"}
                </p>
                <p className="login-date">
                  {mounted && currentTime ? getDateString(currentTime, isChinese) : ""}
                </p>
              </div>

              <div className="login-location-pill">
                <span className="text-sm">📍</span>
                <span className="ml-2">
                  {displayCityName}
                </span>
              </div>
            </div>
          </section>

          <section className="login-sheet">
            <div className="login-form-stack">
              <h2 className="login-title">
                {isLogin ? t("Log In", "登入") : t("Sign Up", "註冊")}
              </h2>

              <div className="login-social-grid" aria-label={t("Social login options", "社群登入選項")}>
                <button
                  type="button"
                  className="login-social-button login-social-google"
                  onClick={() => handleSocialLogin("Google")}
                >
                  <span className="login-social-mark" aria-hidden="true">G</span>
                  <span>{t("Google", "Google")}</span>
                </button>

                <button
                  type="button"
                  className="login-social-button login-social-facebook"
                  onClick={() => handleSocialLogin("Facebook")}
                >
                  <span className="login-social-mark" aria-hidden="true">f</span>
                  <span>{t("Facebook", "Facebook")}</span>
                </button>
              </div>

              <div className="login-divider">
                <span>{t("or continue with email", "或使用 Email 繼續")}</span>
              </div>

              {!isLogin && (
                <div className="login-field">
                  <span className="login-field-icon">👤</span>
                  <input
                    className="login-field-input"
                    placeholder={t("Username", "使用者名稱")}
                  />
                </div>
              )}

              <div className="login-field">
                <span className="login-field-icon">
                  {isLogin ? "✉️" : "@"}
                </span>
                <input
                  className="login-field-input"
                  placeholder={isLogin ? t("Username or Email", "使用者名稱或 Email") : t("Email Address", "Email 地址")}
                />
              </div>

              <div className="login-field">
                <span className="login-field-icon">🔒</span>
                <input
                  type="password"
                  className="login-field-input"
                  placeholder={t("Password", "密碼")}
                />
              </div>

              <button className="login-submit">
                {isLogin ? t("Log In", "登入") : t("Register", "註冊")}
              </button>

              <button
                type="button"
                onClick={() => setIsLogin((value) => !value)}
                className="login-switch"
              >
                {isLogin ? t("No account? ", "還沒有帳號？") : t("Already have an account? ", "已經有帳號？")}
                <span className="login-switch-accent">
                  {isLogin ? t("Register", "註冊") : t("Login", "登入")}
                </span>
              </button>

              <Link
                href="/home"
                className="login-preview-link"
              >
                {t("Preview app without login", "不登入先預覽 App")}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
