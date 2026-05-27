"use client";

function SunOrb({ small = false }) {
  return (
    <div className={small ? "weather-sun weather-sun-small" : "weather-sun"} aria-hidden="true">
      <svg viewBox="0 0 100 100" role="presentation">
        <defs>
          <linearGradient id="weatherSunGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff7ad" />
            <stop offset="100%" stopColor="#ffa900" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="22" fill="url(#weatherSunGradient)" />
        {Array.from({ length: 12 }).map((_, index) => (
          <path
            key={index}
            d="M50 5 L50 20"
            stroke="#ffd700"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.6"
            transform={`rotate(${index * 30} 50 50)`}
          />
        ))}
      </svg>
    </div>
  );
}

function PremiumCloud({ y, delay, scale }) {
  return (
    <div
      className="weather-cloud-wrapper"
      style={{
        "--cloud-y": `${y}px`,
        "--cloud-delay": `${delay}ms`,
        "--cloud-scale": scale,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 50" role="presentation">
        <path
          d="M25 40 Q25 40 25 40 A15 15 0 0 1 15 15 A20 20 0 0 1 50 10 A15 15 0 0 1 75 15 A15 15 0 0 1 85 35 A15 15 0 0 1 25 40"
          fill="rgba(255,255,255,0.95)"
        />
        <circle cx="35" cy="25" r="12" fill="rgba(255,255,255,0.6)" />
        <circle cx="60" cy="22" r="10" fill="rgba(255,255,255,0.5)" />
      </svg>
    </div>
  );
}

function Stars() {
  return (
    <div className="weather-layer" aria-hidden="true">
      {Array.from({ length: 20 }).map((_, index) => (
        <span
          key={index}
          className="weather-star"
          style={{
            "--star-x": `${(index * 47 + 11) % 100}%`,
            "--star-y": `${(index * 61 + 17) % 250}px`,
            "--star-delay": `${index * 200}ms`,
            "--star-duration": `${2000 + ((index * 89) % 1000)}ms`,
          }}
        />
      ))}
    </div>
  );
}

function Rain() {
  return (
    <div className="weather-layer" aria-hidden="true">
      {Array.from({ length: 60 }).map((_, index) => (
        <span
          key={index}
          className="weather-rain-drop"
          style={{
            "--rain-x": `${(index * 37 + 5) % 100}%`,
            "--rain-delay": `${(index * 97) % 2000}ms`,
            "--rain-duration": `${1000 + ((index * 53) % 500)}ms`,
          }}
        />
      ))}
    </div>
  );
}

function Clouds() {
  return (
    <div className="weather-layer" aria-hidden="true">
      <PremiumCloud y={20} delay={0} scale={1.2} />
      <PremiumCloud y={80} delay={5000} scale={0.8} />
      <PremiumCloud y={140} delay={12000} scale={1.5} />
      <PremiumCloud y={50} delay={20000} scale={0.6} />
    </div>
  );
}

function Wind() {
  return (
    <div className="weather-layer" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <span
          key={`line-${index}`}
          className="weather-wind-line"
          style={{
            "--wind-y": `${20 + index * 25}px`,
            "--wind-delay": `${(index * 111) % 900}ms`,
            "--wind-duration": `${1500 + ((index * 137) % 1000)}ms`,
          }}
        />
      ))}
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={`leaf-${index}`}
          className="weather-leaf"
          style={{
            "--leaf-y": `${(index * 73 + 19) % 300}px`,
            "--leaf-delay": `${(index * 173) % 1800}ms`,
            "--leaf-duration": `${4000 + ((index * 197) % 2000)}ms`,
          }}
        />
      ))}
    </div>
  );
}

function normalizeWeatherType(type = "") {
  if (type === "rain") return "raining";
  return type;
}

export default function WeatherBackground({ weather, hour = 12 }) {
  const code = weather?.weatherCode ?? 0;
  const speed = weather?.windSpeed ?? 0;
  const type = normalizeWeatherType(weather?.type || "sunny");
  const safeHour = Number.isFinite(hour) ? hour : 12;

  const isNight = safeHour >= 18 || safeHour < 5;
  const isMorning = safeHour >= 5 && safeHour < 11;
  const isNoon = safeHour >= 11 && safeHour < 18;
  const isRainy = code >= 51 || type === "raining" || type === "storm";
  const isCloudy = code === 3 || code === 45 || code === 48 || isRainy || type === "cloudy";
  const isSunny = (code >= 0 && code <= 2) || type === "sunny" || type === "partly";
  const isWindy = speed > 7 || type === "windy";
  const isSunnyFallback = isSunny || code === 1;

  let variant = "sunny";
  if (isNight) variant = "night";
  else if (isRainy) variant = "rain";
  else if (isCloudy) variant = "cloudy";
  else if (isNoon) variant = "sunny";

  return (
    <div className={`weather-background weather-background-${variant}`}>
      {isNight && <Stars />}
      {!isNight && isSunnyFallback && <SunOrb />}
      {!isNight && !isSunny && !isRainy && ![3, 45, 48].includes(code) && (isMorning || isNoon) && (
        <SunOrb small />
      )}
      {isRainy && <Rain />}
      {(isCloudy || isSunnyFallback) && <Clouds />}
      {isWindy && <Wind />}
    </div>
  );
}
