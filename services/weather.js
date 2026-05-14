import axios from 'axios';
export const getWeatherType = (code, windSpeed) => {
  if (code >= 95) return 'raining'; 
  if (code >= 51) return 'raining'; 
  if (windSpeed > 7) return 'windy';
  if (code === 3 || code === 45 || code === 48) return 'cloudy'; 
  if (code >= 0 && code <= 2) return 'sunny'; 
  return 'sunny'; 
};
const weatherCache = new Map();
const CACHE_STALE_TIME = 60000; 
export const fetchWeather = async (lat, lon) => {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const now = Date.now();
  if (weatherCache.has(cacheKey)) {
    const { data, timestamp } = weatherCache.get(cacheKey);
    if (now - timestamp < CACHE_STALE_TIME) {
        return data;
    }
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m`;
    const response = await axios.get(url);
    const current = response.data.current;
    const result = {
      temp: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windDir: current.wind_direction_10m,
      weatherCode: current.weather_code,
      cloudCover: current.cloud_cover,
      type: getWeatherType(current.weather_code, current.wind_speed_10m),
      timestamp: current.time
    };
    weatherCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  } catch (error) {
    console.error('Weather fetch failed:', error.message);
    return null;
  }
};
