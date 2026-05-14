import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { saveHourlySnapshot } from './historyStore';
const API_BASE_URL = 'http://192.168.137.1:8080';
const CACHE_KEY_ALL = 'poll_cache_all';
export const CITY_COORDS = {
  "Taipei": {latitude: 25.0330, longitude: 121.5654, region: 'NORTH'}, 
  "New Taipei": {latitude: 25.0110, longitude: 121.4617, region: 'NORTH'},
  "Keelung": {latitude: 25.1276, longitude: 121.7392, region: 'NORTH'}, 
  "Taoyuan": {latitude: 24.9936, longitude: 121.3010, region: 'NORTH'}, 
  "Hsinchu": {latitude: 24.8138, longitude: 120.9675, region: 'NORTH'},
  "Hsinchu County": {latitude: 24.8383, longitude: 121.0177, region: 'NORTH'},
  "Yilan": {latitude: 24.7554, longitude: 121.7582, region: 'NORTH'}, 
  "Miaoli": {latitude: 24.5602, longitude: 120.8214, region: 'WEST'}, 
  "Taichung": {latitude: 24.1477, longitude: 120.6736, region: 'WEST'},
  "Changhua": {latitude: 24.0816, longitude: 120.5385, region: 'WEST'},
  "Nantou": {latitude: 23.9037, longitude: 120.6835, region: 'WEST'}, 
  "Yunlin": {latitude: 23.7092, longitude: 120.4313, region: 'WEST'},
  "Chiayi": {latitude: 23.4801, longitude: 120.4491, region: 'SOUTH'}, 
  "Chiayi County": {latitude: 23.4518, longitude: 120.2555, region: 'SOUTH'}, 
  "Tainan": {latitude: 22.9997, longitude: 120.2270, region: 'SOUTH'}, 
  "Kaohsiung": {latitude: 22.6273, longitude: 120.3014, region: 'SOUTH'},
  "Pingtung": {latitude: 22.6715, longitude: 120.4870, region: 'SOUTH'},
  "Hualien": {latitude: 23.9785, longitude: 121.6033, region: 'EAST'},
  "Taitung": {latitude: 22.7583, longitude: 121.1444, region: 'EAST'},
  "Penghu": {latitude: 23.5711, longitude: 119.5800, region: 'EAST'},
  "Kinmen": {latitude: 24.4327, longitude: 118.3225, region: 'EAST'}, 
  "Matsu": {latitude: 26.1557, longitude: 119.9544, region: 'EAST'}
};
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' }
});
export const filterRecordsByDay = (records, date) => {
    const d = new Date(date).toDateString();
    return records.filter(r => new Date(r.timestamp).toDateString() === d);
};
const fetchWithTimeout = async (url, ms = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
};
export const fetchPollution = async (county) => {
  try {
    const all = await fetchAllPollution();
    const cityData = all.find(c => c.county === county) || { pm25: 12.0, time: "Now" };
    return { ...cityData, source: 'live' };
  } catch (error) {
    return { pm25: 10.0, county, status: 'error', source: 'error' };
  }
};
export const fetchAllPollution = async (userCity = null) => {
  try {
    const lats = Object.values(CITY_COORDS).map(c => c.latitude).join(',');
    const lons = Object.values(CITY_COORDS).map(c => c.longitude).join(',');
    const cities = Object.keys(CITY_COORDS);
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=pm2_5,pm10,carbon_monoxide&timezone=Asia/Taipei`;
    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia/Taipei`;
    const [aqRes, wRes] = await Promise.all([
        fetchWithTimeout(aqUrl),
        fetchWithTimeout(wUrl)
    ]);
    const rawAq = await aqRes.json();
    const rawW = await wRes.json();
    const minute = new Date().getMinutes();
    const data = cities.map((city, index) => {
        const itemAq = rawAq[index];
        const itemW = rawW[index];
        const base = itemAq.current.pm2_5 || 10.0;
        const noise = (Math.sin(minute + index) * 0.8);
        return {
            county: city,
            region: CITY_COORDS[city].region,
            pm25: Math.max(0, base + noise),
            pm10: itemAq.current.pm10 || 15.0,
            co: itemAq.current.carbon_monoxide || 150.0,
            weatherCode: itemW.current.weather_code,
            windSpeed: itemW.current.wind_speed_10m,
            temp: itemW.current.temperature_2m,
            humidity: itemW.current.relative_humidity_2m,
            time: itemAq.current.time.replace('T', ' ')
        };
    });
    if (Array.isArray(data) && data.length > 0) {
        await AsyncStorage.setItem(CACHE_KEY_ALL, JSON.stringify({ data, timestamp: Date.now() }));
        saveHourlySnapshot(data, userCity);
        const pref = await AsyncStorage.getItem('pref_notifs');
        const lastAlertTime = await AsyncStorage.getItem('last_pollution_alert_time');
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        if (pref === 'true' && (!lastAlertTime || (now - parseInt(lastAlertTime)) > oneHour)) {
            let targetCity = null;
            if (userCity) {
                const myData = data.find(c => c.county.toLowerCase().includes(userCity.toLowerCase()));
                if (myData && myData.pm25 > 50) {
                    targetCity = myData;
                }
            }
            if (!targetCity) {
                const highCities = data.filter(c => c.pm25 > 50);
                if (highCities.length > 0) {
                    targetCity = highCities.sort((a, b) => b.pm25 - a.pm25)[0];
                }
            }
            if (targetCity) {
                const isUserLoc = userCity && targetCity.county.toLowerCase().includes(userCity.toLowerCase());
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: isUserLoc ? "⚠️ UNHEALTHY AIR AT YOUR LOCATION" : "🌫️ High Pollution Alert",
                        body: `${targetCity.county} has PM2.5 of ${targetCity.pm25.toFixed(1)} µg/m³. Wear a mask!`,
                        sound: true,
                    },
                    trigger: null,
                });
                await AsyncStorage.setItem('last_pollution_alert_time', now.toString());
            }
        }
    }
    return data;
  } catch (error) {
    console.warn('fetchAllPollution failed:', error.message);
    const cached = await AsyncStorage.getItem(CACHE_KEY_ALL);
    if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.data;
    }
    return [];
  }
};
export const submitTrack = async (lat, lng, pm25, county) => {
  try {
    await api.post('/api/track', {
      lat, lng,
      pm25: parseFloat(pm25),
      county,
      timestamp: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.warn('submitTrack failed:', err.message);
    return false;
  }
};
export const fetchRecords = async () => {
    return [];
};
const callGemini = async (prompt) => {
    const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const configs = [
        { ver: 'v1', mod: 'gemini-1.5-flash' },
        { ver: 'v1beta', mod: 'gemini-1.5-flash-latest' },
        { ver: 'v1beta', mod: 'gemini-1.5-pro-latest' },
        { ver: 'v1beta', mod: 'gemini-pro' }
    ];
    let lastError = null;
    for (const config of configs) {
        try {
            const url = `https://generativelanguage.googleapis.com/${config.ver}/models/${config.mod}:generateContent?key=${key}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 50 }
                })
            });
            const data = await res.json();
            if (data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text.trim().replace(/\n/g, ' ');
            }
            if (data.error) throw new Error(data.error.message);
        } catch (e) {
            lastError = e;
            console.warn(`Gemini Config ${config.ver}/${config.mod} failed:`, e.message);
        }
    }
    throw lastError || new Error("AI Connectivity Failed");
};
export const fetchAiSuggestion = async (county, pm25, lang = 'EN', userProfile = null) => {
    let profileContext = "";
    if (userProfile) {
        const age = ['<18', '18-35', '36-60', '60+'][userProfile.ageLevel - 1] || 'Average Age';
        const conds = (userProfile.conditions || []).join(', ') || 'No known conditions';
        const activity = ['Sedentary', 'Moderate', 'Vibrant'][userProfile.activityLevel - 1] || 'Moderate';
        profileContext = `User Profile: ${age} years old, has ${conds}, activity level: ${activity}. `;
    }
    const prompt = `Act as a Taiwan Health expert. ${profileContext}For the city of ${county}, the current PM2.5 is ${pm25} µg/m3. Provide one very short (max 15 words) personalized pro advice about safety or masks in ${lang === 'ZH' ? 'Traditional Chinese' : 'English'}. Start with '${lang === 'ZH' ? '健康建議' : 'Health'}:'`;
    try {
        const text = await callGemini(prompt);
        return { suggestion: text };
    } catch (e) {
        console.warn("Gemini Live Suggestion failed:", e.message);
        return { suggestion: lang === 'ZH' ? `安全：${county} 的空氣品質為 ${pm25}µg。請自保。` : `Safety: Air quality in ${county} is ${pm25}µg. Stay safe.` };
    }
};
export const fetchForecastAdvice = async (county, pm25, lang = 'EN', userProfile = null) => {
    let profileContext = "";
    if (userProfile) {
        const conds = (userProfile.conditions || []).join(', ') || 'No known conditions';
        profileContext = `The user has ${conds}. `;
    }
    const prompt = `Act as a Taiwan Weather analyst. ${profileContext}The air quality in ${county} has a PM2.5 of ${pm25}. Provide a 1-sentence forecast trend prediction in ${lang === 'ZH' ? 'Traditional Chinese' : 'English'} (max 15 words). Factor in the user's health if relevant.`;
    try {
        const text = await callGemini(prompt);
        return { suggestion: text };
    } catch (e) { return { suggestion: lang === 'ZH' ? `趨勢：預計${county}空氣品質穩定。` : `Trend: Stable conditions expected for ${county}.` }; }
};
export const fetchRouteAdvice = async (start, end, dist, method, pm25, lang = 'EN', userProfile = null) => {
    let profileContext = "";
    if (userProfile) {
        const conds = (userProfile.conditions || []).join(', ') || 'No known conditions';
        const fitness = ['Soft', 'Steady', 'Strong'][userProfile.fitnessLevel - 1] || 'Steady';
        profileContext = `User has ${conds} and a fitness level of ${fitness}. `;
    }
    const prompt = `Act as an AI route planner for Taiwan. ${profileContext}Trip from ${start} to ${end} is ${dist}km by ${method}. Current PM2.5 is ${pm25}. Give a 1-sentence personalized route advice in ${lang === 'ZH' ? 'Traditional Chinese' : 'English'} (max 15 words).`;
    try {
        const text = await callGemini(prompt);
        return { suggestion: text };
    } catch (e) { return { suggestion: lang === 'ZH' ? "建議：注意交通安全與空氣品質。" : "Advice: Watch traffic and air quality." }; }
};
export const fetchRoute = async (start, end, profile = 'driving') => {
  let osrmProfile = 'car';
  if (profile === 'bike' || profile === 'bicycle') osrmProfile = 'bicycle';
  if (profile === 'foot' || profile === 'walking') osrmProfile = 'foot';
  const url = `http://router.project-osrm.org/route/v1/${osrmProfile}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      return {
        coords: data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] })),
        distance: data.routes[0].distance / 1000,
        duration: data.routes[0].duration / 60
      };
    }
  } catch (e) {
    console.warn('OSRM Route fetch failed:', e.message);
  }
  return null;
};
