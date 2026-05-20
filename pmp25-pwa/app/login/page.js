"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CITY_COORDS, getNearestCity } from "@/lib/cities";
import { fetchWeatherByCoords, weatherText } from "@/lib/webWeather";

function getTimeString(date) {
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getDateString(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);

  const [cityName, setCityName] = useState("Hsinchu City");
  const [weatherType, setWeatherType] = useState("sunny");
  const [weatherLine, setWeatherLine] = useState(
    "It's beautifully sunny in Hsinchu City."
  );

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
        setWeatherLine(weatherText(weather.type, city));
      } catch {
        setCityName(city);
        setWeatherType("sunny");
        setWeatherLine(weatherText("sunny", city));
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

  const weatherLines = splitWeatherLine(weatherLine);

  return (
    <main className="app-root">
      <div className="login-frame">
        <div className={`weather-bg weather-${weatherType}`} />
        {weatherType === "sunny" && <div className="sun-ray" />}
        <div className="weather-dot" />

        <div className="login-content">
          <section className="login-hero">
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
                  {mounted && currentTime ? getDateString(currentTime) : ""}
                </p>
              </div>

              <div className="login-location-pill">
                <span className="text-sm">📍</span>
                <span className="ml-2">
                  {cityName}
                </span>
              </div>
            </div>
          </section>

          <div className="h-8 shrink-0" />

          <section className="login-sheet">
            <div className="login-form-stack">
              <h2 className="login-title">
                {isLogin ? "Log In" : "Sign Up"}
              </h2>

              {!isLogin && (
                <div className="login-field">
                  <span className="login-field-icon">👤</span>
                  <input
                    className="login-field-input"
                    placeholder="Username"
                  />
                </div>
              )}

              <div className="login-field">
                <span className="login-field-icon">
                  {isLogin ? "✉️" : "@"}
                </span>
                <input
                  className="login-field-input"
                  placeholder={isLogin ? "Username or Email" : "Email Address"}
                />
              </div>

              <div className="login-field">
                <span className="login-field-icon">🔒</span>
                <input
                  type="password"
                  className="login-field-input"
                  placeholder="Password"
                />
              </div>

              <button className="login-submit">
                {isLogin ? "Log In" : "Register"}
              </button>

              <button
                type="button"
                onClick={() => setIsLogin((value) => !value)}
                className="login-switch"
              >
                {isLogin ? "No account? " : "Already have an account? "}
                <span className="login-switch-accent">
                  {isLogin ? "Register" : "Login"}
                </span>
              </button>

              <Link
                href="/home"
                className="login-preview-link"
              >
                Preview app without login
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
