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
      <div className="login-frame relative mx-auto overflow-hidden bg-black text-white shadow-2xl">
        <div className={`weather-bg weather-${weatherType}`} />
        {weatherType === "sunny" && <div className="sun-ray" />}
        <div className="weather-dot" />

        <div className="relative z-10 flex min-h-screen flex-col">
          <section className="px-10 pb-8 pt-16">
            <h1 className="text-[48px] font-black leading-[1.15] tracking-[-2px] text-white drop-shadow-[0_6px_8px_rgba(0,0,0,0.42)]">
              {weatherLines.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </h1>

            <div className="mt-7 h-[5px] w-[54px] rounded-full bg-white" />

            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-[36px] font-black tracking-wide text-white drop-shadow-xl">
                  {mounted && currentTime ? getTimeString(currentTime) : "--:--:--"}
                </p>
                <p className="mt-2 text-base font-black text-white drop-shadow">
                  {mounted && currentTime ? getDateString(currentTime) : ""}
                </p>
              </div>

              <div className="mb-1 flex items-center rounded-full bg-white/25 px-4 py-2 backdrop-blur-md">
                <span className="text-sm">📍</span>
                <span className="ml-2 text-[14px] font-extrabold text-white">
                  {cityName}
                </span>
              </div>
            </div>
          </section>

          <div className="h-8 shrink-0" />

          <section className="mt-auto rounded-t-[45px] bg-white px-10 pb-9 pt-10 text-slate-950 shadow-2xl">
            <div className="space-y-4">
              <h2 className="mb-3 text-[32px] font-black tracking-[-0.04em] text-[#111]">
                {isLogin ? "Log In" : "Sign Up"}
              </h2>

              {!isLogin && (
                <div className="flex h-16 items-center rounded-[18px] border border-[#eceef2] bg-[#f8f9fa] px-5 shadow-inner">
                  <span className="mr-4 text-xl text-slate-500">👤</span>
                  <input
                    className="w-full bg-transparent text-base font-black text-[#1a1a1a] outline-none placeholder:text-[#999]"
                    placeholder="Username"
                  />
                </div>
              )}

              <div className="flex h-16 items-center rounded-[18px] border border-[#eceef2] bg-[#f8f9fa] px-5 shadow-inner">
                <span className="mr-4 text-xl text-slate-500">
                  {isLogin ? "✉️" : "@"}
                </span>
                <input
                  className="w-full bg-transparent text-base font-black text-[#1a1a1a] outline-none placeholder:text-[#999]"
                  placeholder={isLogin ? "Username or Email" : "Email Address"}
                />
              </div>

              <div className="flex h-16 items-center rounded-[18px] border border-[#eceef2] bg-[#f8f9fa] px-5 shadow-inner">
                <span className="mr-4 text-xl text-slate-500">🔒</span>
                <input
                  type="password"
                  className="w-full bg-transparent text-base font-black text-[#1a1a1a] outline-none placeholder:text-[#999]"
                  placeholder="Password"
                />
              </div>

              <button className="mt-2 h-16 w-full rounded-[20px] bg-gradient-to-r from-[#ffc09b] to-[#ff8fb3] text-[17px] font-black uppercase tracking-[0.2em] text-white shadow-lg">
                {isLogin ? "Log In" : "Register"}
              </button>

              <button
                type="button"
                onClick={() => setIsLogin((value) => !value)}
                className="w-full pt-4 text-center text-base font-black text-[#999]"
              >
                {isLogin ? "No account? " : "Already have an account? "}
                <span className="font-black text-[#6A11CB]">
                  {isLogin ? "Register" : "Login"}
                </span>
              </button>

              <Link
                href="/home"
                className="block pt-1 text-center text-xs font-bold text-slate-400"
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
