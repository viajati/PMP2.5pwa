import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
const SettingsContext = createContext();
const PREF_THEME = 'pref_theme';
const PREF_LANG = 'pref_lang';
const PREF_NOTIFS = 'pref_notifs';
const translations = {
  EN: {
    live_track: 'LIVE TRACK', archive: 'ARCHIVE', stats: 'STATISTICS', settings: 'SETUP',
    search: 'Search city...', actual: 'Actual', potential: 'Potential', health_status: 'HEALTHY',
    good: 'Excellent', fair: 'Good', moderate: 'Fair', hazardous: 'Hazardous',
    track_score: 'Track Score', caqi: 'CAQI', forecast: 'FORECAST', planner: 'PLANNER',
    recent: 'CURRENT', dark_mode: 'Dark Mode', chinese: 'Chinese Interface', alerts: 'Pollution Alerts',
    clear_cache: 'Clear History Cache', profile: 'PROFILE', setup: 'PREFERENCES', data: 'SENSORS & DATA',
    pick_destination: 'Pick a destination for AI routing...', start: 'Start', destination: 'Destination',
    pollution: 'POLLUTION', wind: 'WIND', humidity: 'HUMIDITY'
  },
  ZH: {
    live_track: '即時監測', archive: '歷史紀錄', stats: '統計數據', settings: '設定頁面',
    search: '搜尋城市...', actual: '目前狀態', potential: '預測趨勢', health_status: '空氣健康',
    good: '優', fair: '普通', moderate: '敏感', hazardous: '危險',
    track_score: '追蹤分數', caqi: '空氣品質指數', forecast: '未來預報', planner: '路線規劃',
    recent: '目前位置', dark_mode: '深色主題', chinese: '繁體中文界面', alerts: '污染預警',
    clear_cache: '清除快取紀錄', profile: '個人檔案', setup: '偏好設定', data: '感測器與數據',
    pick_destination: '請選擇一個目的地來進行 AI 路線規劃...', start: '起點', destination: '目標',
    pollution: '污染', wind: '風速', humidity: '濕度',
    'Taipei': '台北', 'New Taipei': '新北', 'Keelung': '基隆', 'Taoyuan': '桃園', 'Hsinchu': '新竹',
    'Hsinchu County': '新竹縣', 'Miaoli': '苗栗', 'Taichung': '台中', 'Changhua': '彰化', 'Nantou': '南投',
    'Yunlin': '雲林', 'Chiayi': '嘉義', 'Chiayi County': '嘉義縣', 'Tainan': '台南', 'Kaohsiung': '高雄',
    'Pingtung': '屏東', 'Yilan': '宜蘭', 'Hualien': '花蓮', 'Taitung': '台東', 'Penghu': '澎湖', 'Kinmen': '金門', 'Matsu': '馬祖',
    'NORTH': '北部', 'WEST': '中部', 'SOUTH': '南部', 'EAST': '東部', 'ai_error': 'AI 建議：系統連線不穩定...'
  }
};
export const SettingsProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('EN');
  const [notifications, setNotifications] = useState(false);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    loadSettings();
  }, []);
  const loadSettings = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(PREF_THEME);
      const savedLang = await AsyncStorage.getItem(PREF_LANG);
      const savedNotifs = await AsyncStorage.getItem(PREF_NOTIFS);
      if (savedTheme) setTheme(savedTheme);
      if (savedLang) setLanguage(savedLang);
      if (savedNotifs) setNotifications(savedNotifs === 'true');
    } finally {
      setIsReady(true);
    }
  };
  const toggleTheme = async (mode) => {
    setTheme(mode);
    await AsyncStorage.setItem(PREF_THEME, mode);
  };
  const toggleLanguage = async (lang) => {
    setLanguage(lang);
    await AsyncStorage.setItem(PREF_LANG, lang);
  };
  const toggleNotifications = async (val) => {
    setNotifications(val);
    await AsyncStorage.setItem(PREF_NOTIFS, val ? 'true' : 'false');
  };
  const t = (key) => translations[language][key] || key;
  return (
    <SettingsContext.Provider value={{ theme, language, notifications, isReady, toggleTheme, toggleLanguage, toggleNotifications, t }}>
      {children}
    </SettingsContext.Provider>
  );
};
export const useSettings = () => useContext(SettingsContext);
