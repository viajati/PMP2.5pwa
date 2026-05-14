import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, StatusBar } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { fetchAllPollution, fetchRecords, fetchRoute, fetchAiSuggestion, fetchForecastAdvice, fetchRouteAdvice, CITY_COORDS } from '../services/api';
import { fetchWeather, getWeatherType } from '../services/weather';
import { generateMockHistory } from '../services/historyStore';
import { useSettings } from '../context/SettingsContext';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import WeatherHeader from '../components/WeatherHeader';
import ForecastDashboard from '../components/ForecastDashboard';
import RefinedLoader from '../components/RefinedLoader';
const { width, height } = Dimensions.get('window');
export default function RecordsScreen() {
    const { theme, t, language } = useSettings();
    const { user } = useAuth();
    const isDark = theme === 'dark';
    const [filterMode, setFilterMode] = useState('LIVE');
    const [loading, setLoading] = useState(true);
    const [liveCities, setLiveCities] = useState([]);
    const [records, setRecords] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState('NORTH');
    const [selectedCity, setSelectedCity] = useState('Taipei');
    const [pm25, setPm25] = useState(0);
    const [pm10, setPm10] = useState(0);
    const [co, setCo] = useState(0);
    const [weather, setWeather] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [liveAdvice, setLiveAdvice] = useState("Analyzing atmosphere...");
    const [forecastAdvice, setForecastAdvice] = useState("");
    const [tripAdvice, setTripAdvice] = useState("");
    const [startCity, setStartCity] = useState('Taipei');
    const [endCity, setEndCity] = useState('Kaohsiung');
    const [transport, setTransport] = useState('car');
    const [tripData, setTripData] = useState(null);
    const tabSlider = useRef(new Animated.Value(0)).current;
    const mapRef = useRef(null);
    const tabs = ['LIVE', 'PLANNER', 'FORECAST'];
    useEffect(() => {
        const idx = tabs.indexOf(filterMode);
        Animated.spring(tabSlider, { toValue: idx * ((width - 40) / tabs.length), useNativeDriver: true }).start();
        refreshData(true);
    }, [filterMode]);
    const refreshData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            await generateMockHistory(user);
            const [pData, recs] = await Promise.all([fetchAllPollution(selectedCity), fetchRecords()]);
            if (pData) {
                setLiveCities(pData);
                const { saveHourlySnapshot } = require('../services/historyStore');
                saveHourlySnapshot(pData, selectedCity, user);
            }
            if (recs) setRecords(recs);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };
    const updateForecastAdvice = async (city, val) => {
        try {
            const data = await fetchForecastAdvice(city, val, language, user?.profile);
            setForecastAdvice(data.suggestion);
        } catch (e) {}
    };
    useEffect(() => {
        if (liveCities.length > 0) {
            const currentP = liveCities.find(c => c.county === selectedCity);
            if (currentP) {
                const newPm25 = parseFloat(currentP.pm25 || 0);
                setPm25(newPm25);
                setPm10(parseFloat(currentP.pm10 || 0));
                setCo(parseFloat(currentP.co || 0));
                if (filterMode === 'LIVE') {
                    (async () => {
                        setWeatherLoading(true);
                        try {
                            const res = await fetchAiSuggestion(selectedCity, newPm25.toFixed(1), language, user?.profile);
                            setLiveAdvice(res.suggestion);
                            const wData = {
                                temp: currentP.temp,
                                humidity: currentP.humidity,
                                windSpeed: currentP.windSpeed,
                                weatherCode: currentP.weatherCode,
                                type: getWeatherType(currentP.weatherCode, currentP.windSpeed)
                            };
                            setWeather(wData);
                        } catch (e) { console.warn(e); }
                        setWeatherLoading(false);
                    })();
                }
                if (filterMode === 'FORECAST') {
                    updateForecastAdvice(selectedCity, newPm25.toFixed(1));
                }
                if (filterMode === 'PLANNER') {
                    setEndCity(selectedCity);
                }
            }
        }
    }, [selectedCity, liveCities, filterMode, language]);
    const calculateRoute = async () => {
        if (startCity === endCity) return; 
        try {
            const profile = transport === 'bike' ? 'bike' : (transport === 'motor' ? 'driving' : transport);
            const res = await fetchRoute(CITY_COORDS[startCity], CITY_COORDS[endCity], profile);
            if (res) {
                setTripData(res);
                if (mapRef.current) {
                    setTimeout(() => {
                        mapRef.current.fitToCoordinates(res.coords, { edgePadding: { top: 80, right: 80, bottom: 80, left: 80 }, animated: true });
                    }, 100);
                }
                const advice = await fetchRouteAdvice(startCity, endCity, res.distance.toFixed(1), transport, pm25.toFixed(1), language, user?.profile);
                setTripAdvice(advice.suggestion);
            }
        } catch (e) { console.error(e); }
    };
    useEffect(() => {
        if (filterMode === 'PLANNER') calculateRoute();
    }, [startCity, endCity, transport, filterMode]);
    const filteredLiveList = liveCities.filter(c => c.region === selectedRegion);
    return (
        <View style={[styles.container, isDark && styles.containerDark]}>
            <StatusBar barStyle="light-content" hidden={true} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
                {filterMode === 'LIVE' && <WeatherHeader weather={weather} city={selectedCity} pm25={pm25} />}
                <View style={[styles.tabContentArea, filterMode === 'LIVE' ? {marginTop: -85, zIndex: 10} : {paddingTop: 10}]}>
                    <View style={styles.tabRow}>
                        <Animated.View style={[styles.tabSlider, { width: (width - 40) / tabs.length, transform: [{ translateX: tabSlider }] }]} />
                        {tabs.map(tab => (
                            <TouchableOpacity key={tab} onPress={() => setFilterMode(tab)} style={styles.tab}>
                                <Text style={[styles.tabText, filterMode === tab && {color: '#00D2FF'}]}>{tab === 'LIVE' ? t('live_track') : (tab === 'PLANNER' ? t('planner') : t('forecast'))}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={[styles.globalAiBox, isDark && styles.globalAiBoxDark]}>
                        <View style={styles.aiGlow} />
                        <MaterialCommunityIcons name="auto-fix" size={16} color="#00D2FF" style={{marginRight: 10}} />
                        <Text style={[styles.aiText, isDark && {color: '#fff'}]}>
                            {filterMode === 'LIVE' ? liveAdvice : (filterMode === 'FORECAST' ? forecastAdvice : (tripAdvice || t('pick_destination')))}
                        </Text>
                    </View>
                    {loading ? <RefinedLoader message="Fetching Atmosphere..." /> : 
                    filterMode === 'LIVE' ? (
                        <View style={styles.liveWrapper}>
                            <View style={styles.nwseRow}>
                                {['NORTH', 'WEST', 'SOUTH', 'EAST'].map(r => (
                                    <TouchableOpacity key={r} onPress={() => setSelectedRegion(r)} style={[styles.nwseBtn, isDark && {backgroundColor: '#222'}, selectedRegion === r && (isDark ? styles.nwseBtnActiveBlue : styles.nwseBtnActive)]}>
                                        <Text style={[styles.nwseText, selectedRegion === r && {color: '#fff'}]}>{t(r)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.leaderHeader}>
                                <Text style={styles.sectionTitle}>{t(selectedRegion)} {t('cities').toUpperCase()}</Text>
                                <Text style={styles.fetchTime}>Fetch: {liveCities[0]?.time || 'Fresh'}</Text>
                            </View>
                            {filteredLiveList.map((item) => {
                                const code = item.weatherCode || 0;
                                const speed = item.windSpeed || 0;
                                const type = getWeatherType(code, speed);
                                let iconName = 'weather-sunny';
                                let iconColor = '#FFD700';
                                switch(type) {
                                    case 'raining': 
                                        iconName = 'weather-rainy'; 
                                        iconColor = '#00D2FF'; 
                                        break;
                                    case 'windy': 
                                        iconName = 'weather-windy'; 
                                        iconColor = '#00D2FF'; 
                                        break;
                                    case 'cloudy': 
                                        iconName = (code === 45 || code === 48) ? 'weather-fog' : 'weather-cloudy'; 
                                        iconColor = isDark ? '#E0E0E0' : '#757F9A'; 
                                        break;
                                    case 'sunny':
                                    default:
                                        iconName = code === 1 ? 'weather-partly-cloudy' : 'weather-sunny';
                                        iconColor = '#FFD700';
                                        break;
                                }
                                if (code >= 71 && code <= 86) { iconName = 'weather-snowy'; iconColor = '#E0F7FA'; }
                                if (code >= 95) { iconName = 'weather-lightning'; iconColor = '#FFEB3B'; }
                                return (
                                    <TouchableOpacity key={item.county} onPress={() => setSelectedCity(item.county)} style={[styles.cityRow, isDark && styles.cityRowDark, selectedCity === item.county && styles.activeRow]}>
                                        <View style={[styles.bar, {backgroundColor: item.pm25 < 15 ? '#34C759' : (item.pm25 < 35 ? '#FFCC00' : '#FF3B30')}]} />
                                        <MaterialCommunityIcons name={iconName} size={20} color={iconColor} style={{ marginRight: 10 }} />
                                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.cityName, isDark && {color: '#fff'}]}>{t(item.county)}</Text>
                                        <Text style={[styles.cityPm, isDark && {color: '#fff'}]}>{item.pm25.toFixed(1)} <Text style={styles.µg}>µg</Text></Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : filterMode === 'PLANNER' ? (
                        <View style={styles.planner}>
                            <View style={styles.sideBySide}>
                                <View style={styles.sideCol}>
                                    <Text style={styles.pLabel}>ORIGIN</Text>
                                    <ScrollView style={styles.cityPickScroll}>
                                        {Object.keys(CITY_COORDS).map(city => (
                                            <TouchableOpacity key={city} onPress={() => setStartCity(city)} style={[styles.pickBtn, startCity === city && styles.pickBtnActive]}>
                                                <Text style={[styles.pickText, startCity === city && {color: '#00D2FF'}]}>{t(city)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                                <View style={styles.sideCol}>
                                    <Text style={styles.pLabel}>DESTINATION</Text>
                                    <ScrollView style={styles.cityPickScroll}>
                                        {Object.keys(CITY_COORDS).map(city => (
                                            <TouchableOpacity key={city} onPress={() => setEndCity(city)} style={[styles.pickBtn, endCity === city && styles.pickBtnActive]}>
                                                <Text style={[styles.pickText, endCity === city && {color: '#00D2FF'}]}>{t(city)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                            <View style={styles.plannerActions}>
                                <View style={styles.transportRow}>
                                    {['car', 'bike', 'walk'].map(m => (
                                        <TouchableOpacity key={m} onPress={() => setTransport(m)} style={[styles.tBtn, transport === m && styles.tBtnActive]}>
                                            <MaterialCommunityIcons name={m === 'car' ? 'car' : (m === 'bike' ? 'bicycle' : 'walk')} size={20} color={transport === m ? '#fff' : '#666'} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TouchableOpacity onPress={calculateRoute} style={styles.calcBtn}>
                                    <Text style={styles.calcText}>OPTIMIZE</Text>
                                </TouchableOpacity>
                            </View>
                            {tripData && (
                                <View style={styles.resCard}>
                                    <Text style={styles.resText}>{tripData.distance.toFixed(1)} KM • {Math.round(tripData.duration)} MINS</Text>
                                </View>
                            )}
                            <View style={styles.mapBox}>
                                <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} initialRegion={{latitude: 23.6, longitude: 121, latitudeDelta: 3, longitudeDelta: 3}}>
                                    {tripData && <Polyline coordinates={tripData.coords} strokeWidth={4} strokeColor="#00D2FF" />}
                                    <Marker coordinate={CITY_COORDS[startCity]} title={t(startCity)} pinColor="blue" />
                                    <Marker coordinate={CITY_COORDS[endCity]} title={t(endCity)} pinColor="red" />
                                </MapView>
                            </View>
                        </View>
                    ) : <ForecastDashboard city={selectedCity} setSelectedCity={setSelectedCity} pm25={pm25} pm10={pm10} co={co} user={user} />}
                </View>
            </ScrollView>
        </View>
    );
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    containerDark: { backgroundColor: '#121212' },
    tabContentArea: { marginTop: 10 },
    tabRow: { flexDirection: 'row', height: 45, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 25, padding: 4, marginHorizontal: 20, marginBottom: 20 },
    tabSlider: { position: 'absolute', height: 37, top: 4, left: 4, backgroundColor: '#fff', borderRadius: 20 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    tabText: { fontSize: 10, fontWeight: '900', color: '#999' },
    globalAiBox: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', marginHorizontal: 20, marginBottom: 20,
        padding: 15, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: 'rgba(0,210,255,0.2)', overflow: 'hidden'
    },
    globalAiBoxDark: { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: 'rgba(0,210,255,0.4)' },
    aiGlow: { position: 'absolute', top: -20, left: -20, width: 60, height: 60, backgroundColor: 'rgba(0,210,255,0.1)', borderRadius: 30 },
    aiText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1E293B', lineHeight: 17 },
    liveWrapper: { paddingHorizontal: 25, paddingTop: 5 },
    nwseRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
    nwseBtn: { flex: 1, backgroundColor: '#f0f0f0', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    nwseBtnActive: { backgroundColor: '#121212' },
    nwseBtnActiveBlue: { backgroundColor: '#00D2FF' },
    nwseText: { fontSize: 9, fontWeight: '900', color: '#999' },
    leaderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 11, fontWeight: '900', color: '#333', letterSpacing: 1.5 },
    fetchTime: { fontSize: 9, color: '#00D2FF', fontWeight: 'bold' },
    cityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 18, borderRadius: 20, marginBottom: 10 },
    cityRowDark: { backgroundColor: '#1e1e1e' },
    activeRow: { borderColor: '#00D2FF', borderWidth: 1.5, shadowColor: '#00D2FF', shadowRadius: 5, shadowOpacity: 0.3, elevation: 5 },
    bar: { width: 5, height: 30, borderRadius: 3, marginRight: 15 },
    cityName: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
    cityPm: { fontSize: 18, fontWeight: '900', color: '#1a1a1a' },
    µg: { fontSize: 9, color: '#999' },
    planner: { padding: 20 },
    sideBySide: { flexDirection: 'row', gap: 15, height: 250 },
    sideCol: { flex: 1, backgroundColor: '#f8f9fa', borderRadius: 25, padding: 15 },
    pLabel: { fontSize: 9, fontWeight: '900', color: '#999', marginBottom: 10 },
    cityPickScroll: { flex: 1 },
    pickBtn: { paddingVertical: 8, paddingHorizontal: 10, marginBottom: 5, borderRadius: 10 },
    pickBtnActive: { backgroundColor: 'rgba(0,210,255,0.1)' },
    pickText: { fontSize: 11, fontWeight: 'bold', color: '#555' },
    plannerActions: { flexDirection: 'row', gap: 10, marginVertical: 20 },
    transportRow: { flexDirection: 'row', gap: 5 },
    tBtn: { width: 42, height: 42, backgroundColor: '#f0f0f0', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    tBtnActive: { backgroundColor: '#00D2FF' },
    calcBtn: { flex: 1, backgroundColor: '#121212', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    calcText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    resCard: { marginTop: 0, marginBottom: 20, padding: 20, backgroundColor: 'rgba(0,210,255,0.05)', borderRadius: 20 },
    resText: { fontSize: 16, fontWeight: '900', color: '#1a1a1a', marginBottom: 5 },
    adviceText: { fontSize: 12, color: '#666', lineHeight: 18 },
    mapBox: { height: 280, borderRadius: 30, overflow: 'hidden' },
    map: { flex: 1 }
});
