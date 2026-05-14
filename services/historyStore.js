import AsyncStorage from '@react-native-async-storage/async-storage';
const DEFAULT_HISTORY_KEY = 'pollution_history_v1';
const getUserHistoryKey = (user) => {
    if (!user) return DEFAULT_HISTORY_KEY;
    if (user.id === 'u_angel_001') return DEFAULT_HISTORY_KEY;
    return `pollution_history_${user.id}`;
};
const resolveUser = async (user) => {
    if (user) return user;
    try {
        const session = await AsyncStorage.getItem('current_user_session_v1');
        return session ? JSON.parse(session) : null;
    } catch (e) { return null; }
};
export const saveLocalRecord = async (record, user = null) => {
    try {
        const currentUser = await resolveUser(user);
        const key = getUserHistoryKey(currentUser);
        const raw = await AsyncStorage.getItem(key);
        const history = raw ? JSON.parse(raw) : [];
        const newRecord = {
            id: record.id || Date.now(),
            ...record,
            timestamp: record.timestamp || new Date().toISOString()
        };
        const updated = [newRecord, ...history].slice(0, 2000);
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        return true;
    } catch (e) {
        console.warn('[historyStore] saveLocalRecord failed:', e.message);
        return false;
    }
};
export const saveHourlySnapshot = async (citiesArray, userCity = null, user = null) => {
    try {
        const currentUser = await resolveUser(user);
        const key = getUserHistoryKey(currentUser);
        const raw = await AsyncStorage.getItem(key);
        let history = raw ? JSON.parse(raw) : [];
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        history = history.filter(r => new Date(r.timestamp) >= sevenDaysAgo);
        const timestamp = now.toISOString();
        const records = citiesArray.map((c, i) => ({
            id: `${Date.now()}_${i}`,
            county: c.county,
            pm25: c.pm25,
            pm10: c.pm10,
            co: c.co,
            timestamp: timestamp
        }));
        if (userCity) {
            const currentData = citiesArray.find(c => 
                c.county === userCity || 
                (userCity.includes(c.county)) || 
                (c.county.includes(userCity))
            );
            if (currentData) {
                records.push({
                    id: `user_${Date.now()}`,
                    county: 'USER_PATH',
                    actualCity: currentData.county,
                    pm25: currentData.pm25,
                    pm10: currentData.pm10,
                    co: currentData.co,
                    timestamp: timestamp
                });
            }
        }
        const updated = [...records, ...history].slice(0, 8000);
        await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
        console.warn('[historyStore] saveHourlySnapshot failed:', e.message);
    }
};
export const getLocalRecords = async (user = null) => {
    try {
        const currentUser = await resolveUser(user);
        const key = getUserHistoryKey(currentUser);
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('[historyStore] getLocalRecords failed:', e.message);
        return [];
    }
};
export const clearLocalHistory = async (user = null) => {
    const currentUser = await resolveUser(user);
    const key = getUserHistoryKey(currentUser);
    await AsyncStorage.removeItem(key);
};
export const generateMockHistory = async (user = null) => {
    try {
        const currentUser = await resolveUser(user);
        const key = getUserHistoryKey(currentUser);
        const raw = await AsyncStorage.getItem(key);
        const history = raw ? JSON.parse(raw) : [];
        if (history.length > 300) return;
        const cities = [
            "Taipei City", "New Taipei City", "Keelung City", "Taoyuan City", "Hsinchu City", "Hsinchu County",
            "Miaoli County", "Taichung City", "Changhua County", "Nantou County", "Yunlin County",
            "Chiayi City", "Chiayi County", "Tainan City", "Kaohsiung City", "Pingtung County",
            "Yilan County", "Hualien County", "Taitung County", "Penghu County", "Kinmen County", "Lienchiang County"
        ];
        let mock = [...history];
        const now = new Date();
        for (let c of cities) {
            const hasData = history.some(r => r.county === c);
            if (hasData) continue;
            for (let d = 1; d <= 7; d++) {
                for (let h = 0; h < 24; h += 6) {
                    const ts = new Date(now.getTime() - (d * 86400000) - (h * 3600000));
                    const base = 8 + Math.random() * 30; 
                    mock.push({
                        id: `mock_${c}_${d}_${h}`,
                        county: c,
                        pm25: base,
                        pm10: base * 1.5 + Math.random() * 10,
                        co: 100 + Math.random() * 200,
                        timestamp: ts.toISOString()
                    });
                }
            }
        }
        await AsyncStorage.setItem(key, JSON.stringify(mock));
    } catch (e) {
        console.warn('[historyStore] generateMockHistory failed:', e.message);
    }
};
export const getWeeklySummary = async (cityName, user = null) => {
    try {
        const records = await getLocalRecords(user);
        const days = {};
        records.filter(r => !cityName || r.county === cityName).forEach(r => {
            if (!r.timestamp) return;
            const day = r.timestamp.split('T')[0];
            if (!days[day]) days[day] = { sumPM25: 0, sumPM10: 0, sumCO: 0, count: 0 };
            days[day].sumPM25 += (Number(r.pm25) || 0);
            days[day].sumPM10 += (Number(r.pm10) || 0);
            days[day].sumCO += (Number(r.co) || 0);
            days[day].count++;
        });
        const sortedDays = Object.keys(days).sort().reverse();
        return sortedDays.slice(0, 7).map(d => ({
            day: d,
            avgPM25: days[d].sumPM25 / days[d].count,
            avgPM10: days[d].sumPM10 / days[d].count,
            avgCO: days[d].sumCO / days[d].count,
            count: days[d].count
        }));
    } catch (e) {
        console.warn('[historyStore] getWeeklySummary failed:', e.message);
        return [];
    }
};
