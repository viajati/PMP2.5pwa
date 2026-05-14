import AsyncStorage from '@react-native-async-storage/async-storage';
const DEFAULT_DISTANCE_HISTORY_KEY = 'telemetry_distance_history_v1';
const getTrackKey = (baseKey, user) => {
    if (!user) return baseKey;
    if (user.id === 'u_angel_001') return baseKey; 
    return `${baseKey}_${user.id}`;
};
const resolveUser = async (user) => {
    if (user) return user;
    try {
        const session = await AsyncStorage.getItem('current_user_session_v1');
        return session ? JSON.parse(session) : null;
    } catch (e) { return null; }
};
export const getDateKey = (date = new Date(), user = null) => {
  const d = new Date(date);
  const base = `route_${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`;
  return getTrackKey(base, user);
};
const getDayStr = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};
export const appendPoints = async (newPoints, user = null) => {
  try {
    const currentUser = await resolveUser(user);
    const key = getDateKey(new Date(), currentUser);
    const raw = await AsyncStorage.getItem(key);
    const pts = raw ? JSON.parse(raw) : [];
    const updated = [...pts, ...newPoints];
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    const dist = computeDistanceKm(updated);
    await updateDailyDistance(new Date(), dist, user);
    return dist;
  } catch (e) {
    console.warn('[trackStorage] appendPoints failed:', e.message);
    return 0;
  }
};
export const appendPoint = async (lat, lng, user = null) => {
  return await appendPoints([{ latitude: lat, longitude: lng, timestamp: new Date().toISOString() }], user);
};
export const saveRoute = async (points, user = null) => {
  try {
    const currentUser = await resolveUser(user);
    const key = getDateKey(new Date(), currentUser);
    await AsyncStorage.setItem(key, JSON.stringify(points));
    const dist = computeDistanceKm(points);
    await updateDailyDistance(new Date(), dist, user);
  } catch (e) {
    console.warn('[trackStorage] saveRoute failed:', e.message);
    throw e;
  }
};
export const loadTodayRoute = async (user = null) => {
  try {
    const currentUser = await resolveUser(user);
    const key = getDateKey(new Date(), currentUser);
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[trackStorage] loadTodayRoute failed:', e.message);
    return [];
  }
};
export const loadRouteByKey = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};
export const clearTodayRoute = async (user = null) => {
  try {
    const currentUser = await resolveUser(user);
    await AsyncStorage.removeItem(getDateKey(new Date(), currentUser));
  } catch (e) {}
};
export const updateDailyDistance = async (date, km, user = null) => {
    try {
        const currentUser = await resolveUser(user);
        const dayStr = getDayStr(date);
        const key = getTrackKey(DEFAULT_DISTANCE_HISTORY_KEY, currentUser);
        const raw = await AsyncStorage.getItem(key);
        let history = raw ? JSON.parse(raw) : {};
        history[dayStr] = km;
        const keys = Object.keys(history).sort((a, b) => new Date(b) - new Date(a));
        const pruned = {};
        keys.slice(0, 14).forEach(k => pruned[k] = history[k]);
        await AsyncStorage.setItem(key, JSON.stringify(pruned));
    } catch (e) {
        console.warn('[trackStorage] updateDailyDistance failed:', e.message);
    }
};
export const getWeeklyDistanceHistory = async (user = null) => {
    try {
        const currentUser = await resolveUser(user);
        const key = getTrackKey(DEFAULT_DISTANCE_HISTORY_KEY, currentUser);
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
};
export const getTodayDistance = async (user = null) => {
    const history = await getWeeklyDistanceHistory(user);
    return history[getDayStr()] || 0;
};
export const computeDistanceKm = (points) => {
  if (!points || points.length < 2) return 0;
  let total = 0;
  const p = 0.017453292519943295;
  const c = Math.cos;
  for (let i = 1; i < points.length; i++) {
    const a1 = points[i-1];
    const a2 = points[i];
    const a = 0.5 - c((a2.latitude - a1.latitude) * p)/2
      + c(a1.latitude * p) * c(a2.latitude * p) * (1 - c((a2.longitude - a1.longitude) * p))/2;
    total += 12742 * Math.asin(Math.sqrt(a));
  }
  return total;
};
