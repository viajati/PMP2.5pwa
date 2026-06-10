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

function PremiumCloud({ y, delay, scale, opacity = 0.72, duration = 34000 }) {
  const cloudDelay = delay ? -delay : 0;

  return (
    <div
      className="weather-cloud-wrapper"
      style={{
        "--cloud-y": `${y}px`,
        "--cloud-delay": `${cloudDelay}ms`,
        "--cloud-scale": scale,
        "--cloud-opacity": opacity,
        "--cloud-duration": `${duration}ms`,
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
            "--rain-delay": `${-((index * 97) % 1500)}ms`,
            "--rain-duration": `${1000 + ((index * 53) % 500)}ms`,
          }}
        />
      ))}
    </div>
  );
}

function Clouds({ density = "cloudy" }) {
  const cloudsByDensity = {
    sunny: [
      { y: 20, delay: 0, scale: 1.2, opacity: 0.34, duration: 34000 },
      { y: 80, delay: 5000, scale: 0.8, opacity: 0.3, duration: 31000 },
      { y: 140, delay: 12000, scale: 1.5, opacity: 0.24, duration: 39000 },
      { y: 50, delay: 20000, scale: 0.6, opacity: 0.26, duration: 32000 },
    ],
    partly: [
      { y: 20, delay: 0, scale: 1.2, opacity: 0.58, duration: 34000 },
      { y: 80, delay: 5000, scale: 0.8, opacity: 0.52, duration: 31000 },
      { y: 140, delay: 12000, scale: 1.5, opacity: 0.46, duration: 39000 },
      { y: 50, delay: 20000, scale: 0.6, opacity: 0.42, duration: 32000 },
    ],
    cloudy: [
      { y: 20, delay: 0, scale: 1.2, opacity: 0.82, duration: 34000 },
      { y: 80, delay: 5000, scale: 0.8, opacity: 0.74, duration: 31000 },
      { y: 140, delay: 12000, scale: 1.5, opacity: 0.64, duration: 39000 },
      { y: 50, delay: 20000, scale: 0.6, opacity: 0.6, duration: 32000 },
    ],
  };

  const clouds = cloudsByDensity[density] || cloudsByDensity.cloudy;

  return (
    <div className="weather-layer" aria-hidden="true">
      {clouds.map((cloud, index) => (
        <PremiumCloud
          key={index}
          y={cloud.y}
          delay={cloud.delay}
          scale={cloud.scale}
          opacity={cloud.opacity}
          duration={cloud.duration}
        />
      ))}
    </div>
  );
}

function Wind() {
  const leafConfigs = [
    { y: 18, delay: 0, duration: 5400, drift: 30, end: -12, scale: 0.86 },
    { y: 52, delay: 620, duration: 6100, drift: -18, end: 18, scale: 0.72 },
    { y: 86, delay: 1220, duration: 5000, drift: 48, end: -20, scale: 1 },
    { y: 122, delay: 1840, duration: 6600, drift: 12, end: -8, scale: 0.78 },
    { y: 160, delay: 2460, duration: 5700, drift: -34, end: 24, scale: 0.94 },
    { y: 198, delay: 3080, duration: 6400, drift: 36, end: -16, scale: 0.68 },
    { y: 236, delay: 3700, duration: 5200, drift: -10, end: 14, scale: 0.9 },
    { y: 274, delay: 4320, duration: 6900, drift: 56, end: -24, scale: 0.74 },
  ];

  return (
    <div className="weather-layer" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <span
          key={`line-${index}`}
          className="weather-wind-line"
          style={{
            "--wind-y": `${20 + index * 25}px`,
            "--wind-delay": `-${150 + ((index * 111) % 900)}ms`,
            "--wind-duration": `${1500 + ((index * 137) % 1000)}ms`,
          }}
        />
      ))}
      {leafConfigs.map((leaf, index) => (
        <span
          key={`leaf-${index}`}
          className="weather-leaf"
          style={{
            "--leaf-y": `${leaf.y}px`,
            "--leaf-delay": `-${leaf.delay}ms`,
            "--leaf-duration": `${leaf.duration}ms`,
            "--leaf-drift": `${leaf.drift}px`,
            "--leaf-end-drift": `${leaf.end}px`,
            "--leaf-scale": leaf.scale,
          }}
        />
      ))}
    </div>
  );
}

function normalizeWeatherType(type = "") {
  const normalized = String(type).trim().toLowerCase();

  if (normalized === "rain" || normalized === "rainy") return "raining";
  if (normalized === "mostly sunny" || normalized === "partly cloudy" || normalized === "partly-sunny") return "partly";
  if (normalized === "stormy" || normalized === "thunderstorm") return "storm";
  return normalized;
}

export default function WeatherBackground({ weather, hour }) {
  const rawCode = Number(weather?.weatherCode);
  const code = Number.isFinite(rawCode) ? rawCode : 0;

  const rawSpeed = Number(weather?.windSpeed);
  const speed = Number.isFinite(rawSpeed) ? rawSpeed : 0;

  const type = normalizeWeatherType(weather?.type || "sunny");
  const numericHour = Number(hour);
  const safeHour = Number.isFinite(numericHour) ? numericHour : new Date().getHours();

  const isNight = safeHour >= 18 || safeHour < 5;
  const isRainy = [
    51, 53, 55, 56, 57,
    61, 63, 65, 66, 67,
    71, 73, 75, 77,
    80, 81, 82, 85, 86,
  ].includes(code) || type === "raining";
  const isStorm = [95, 96, 99].includes(code) || type === "storm";
  const isPartly = type === "partly" || code === 1 || code === 2;
  const isCloudy = code === 3 || code === 45 || code === 48 || type === "cloudy";
  const isSunny = code === 0 || type === "sunny";
  const isWindy = speed >= 28 || type === "windy";

  let condition = "sunny";
  if (isStorm) condition = "storm";
  else if (isRainy) condition = "rain";
  else if (type === "windy" || (isWindy && !isSunny && !isPartly)) condition = "windy";
  else if (isCloudy) condition = "cloudy";
  else if (isPartly) condition = "partly";

  const variant = isNight ? "night" : condition;

  return (
    <div
      className={[
        "weather-background",
        `weather-background-${variant}`,
        isNight ? "weather-background-after-dark" : "",
      ].join(" ")}
      data-weather-condition={condition}
    >
      {isNight && <Stars />}
      {!isNight && (condition === "sunny" || condition === "partly") && <SunOrb small={condition === "partly"} />}
      {condition === "sunny" && <Clouds density="sunny" />}
      {condition === "partly" && <Clouds density="partly" />}
      {condition === "cloudy" && <Clouds density="cloudy" />}
      {(condition === "rain" || condition === "storm") && <Rain />}
      {isWindy && <Wind />}
    </div>
  );
}
