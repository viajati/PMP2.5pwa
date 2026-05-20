export function weatherCodeToType(code, windSpeed = 0) {
  if (windSpeed >= 28) return "windy";

  if ([95, 96, 99].includes(code)) return "storm";

  if (
    [
      51, 53, 55, 56, 57,
      61, 63, 65, 66, 67,
      71, 73, 75, 77,
      80, 81, 82, 85, 86,
    ].includes(code)
  ) {
    return "raining";
  }

  if ([1, 2, 3, 45, 48].includes(code)) return "cloudy";

  return "sunny";
}

export function weatherText(type, city) {
  if (type === "raining") return `It's raining in ${city}.`;
  if (type === "cloudy") return `The sky is cloudy in ${city}.`;
  if (type === "windy") return `It's quite windy in ${city}.`;
  if (type === "storm") return `Thunderstorms in ${city}.`;
  return `It's beautifully sunny in ${city}.`;
}

export async function fetchWeatherByCoords(latitude, longitude) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch weather");

  const data = await res.json();
  const current = data.current || {};

  const weatherCode = current.weather_code ?? 0;
  const windSpeed = current.wind_speed_10m ?? 0;

  return {
    temperature: current.temperature_2m ?? null,
    humidity: current.relative_humidity_2m ?? null,
    windSpeed,
    weatherCode,
    type: weatherCodeToType(weatherCode, windSpeed),
  };
}
