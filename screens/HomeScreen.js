import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, TextInput, Dimensions, Animated, Easing, FlatList, Image } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSettings } from '../context/SettingsContext';
import { fetchPollution, fetchWeather, fetchAllPollution } from '../services/api';
import { loadTodayRoute, getTodayDistance, appendPoint } from '../services/trackStorage';
import { saveHourlySnapshot } from '../services/historyStore';
import { useAuth } from '../context/AuthContext';
const { width, height } = Dimensions.get('window');
const CITY_COORDS = {
  "Taipei City": {latitude: 25.0330, longitude: 121.5654}, "New Taipei City": {latitude: 25.0110, longitude: 121.4617},
  "Taoyuan City": {latitude: 24.9936, longitude: 121.3010}, "Taichung City": {latitude: 24.1477, longitude: 120.6736},
  "Tainan City": {latitude: 22.9997, longitude: 120.2270}, "Kaohsiung City": {latitude: 22.6273, longitude: 120.3014},
  "Keelung City": {latitude: 25.1276, longitude: 121.7392}, "Hsinchu City": {latitude: 24.8138, longitude: 120.9675},
  "Chiayi City": {latitude: 23.4801, longitude: 120.4491}, "Hsinchu County": {latitude: 24.8383, longitude: 121.0177},
  "Miaoli County": {latitude: 24.5602, longitude: 120.8214}, "Changhua County": {latitude: 24.0816, longitude: 120.5385},
  "Nantou County": {latitude: 23.9037, longitude: 120.6835}, "Yunlin County": {latitude: 23.7092, longitude: 120.4313},
  "Chiayi County": {latitude: 23.4518, longitude: 120.2555}, "Pingtung County": {latitude: 22.6715, longitude: 120.4870},
  "Yilan County": {latitude: 24.7554, longitude: 121.7582}, "Hualien County": {latitude: 23.9785, longitude: 121.6033},
  "Taitung County": {latitude: 22.7583, longitude: 121.1444}, "Penghu County": {latitude: 23.5711, longitude: 119.5800},
  "Kinmen County": {latitude: 24.4327, longitude: 118.3225}, "Lienchiang County": {latitude: 26.1557, longitude: 119.9544}
};
const REGIONS = {
    NORTH: ['Taipei City', 'New Taipei City', 'Keelung City', 'Taoyuan City', 'Hsinchu City', 'Hsinchu County'],
    WEST: ['Miaoli County', 'Taichung City', 'Changhua County', 'Nantou County', 'Yunlin County'],
    SOUTH: ['Chiayi City', 'Chiayi County', 'Tainan City', 'Kaohsiung City', 'Pingtung County'],
    EAST: ['Yilan County', 'Hualien County', 'Taitung County', 'Penghu County', 'Kinmen County', 'Lienchiang County']
};
export default function HomeScreen({ navigation }) {
    const { language, isDark } = useSettings();
    const { user } = useAuth();
    const [location, setLocation] = useState({ latitude: 23.5, longitude: 121.0, latitudeDelta: 3, longitudeDelta: 3 });
    const [search, setSearch] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('ALL');
    const [isSearching, setIsSearching] = useState(false);
    const [todayPath, setTodayPath] = useState([]);
    const [distance, setDistance] = useState(0);
    const [currentCity, setCurrentCity] = useState(null);
    const [teleopMode, setTeleopMode] = useState(false);
    const [teleopPos, setTeleopPos] = useState(null);
    const mapRef = useRef(null);
    const watcher = useRef(null);
    useEffect(() => {
        let isMounted = true;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                const current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 };
                if (isMounted) {
                    setLocation(current);
                    if (mapRef.current) mapRef.current.animateToRegion(current);
                    const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                    if (geo && geo.length > 0) {
                        setCurrentCity(geo[0].city || geo[0].region || geo[0].district);
                    }
                }
                const savedRoute = await loadTodayRoute(user);
                const savedDist = await getTodayDistance(user);
                if (isMounted) {
                    setTodayPath(savedRoute);
                    setDistance(savedDist);
                }
                watcher.current = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, distanceInterval: 10 },
                    async (newLoc) => {
                        if (teleopMode) return; 
                        const { latitude, longitude } = newLoc.coords;
                        const dist = await appendPoint(latitude, longitude, user);
                        const route = await loadTodayRoute(user);
                        if (isMounted) {
                            setTodayPath(route);
                            setDistance(dist);
                            setLocation({ ...location, latitude, longitude });
                        }
                    }
                );
            }
        })();
        return () => {
            isMounted = false;
            if (watcher.current) watcher.current.remove();
        };
    }, [teleopMode]);
    const updateSimulatedLocation = async (lat, lng) => {
        try {
            const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            let city = currentCity;
            if (geo && geo.length > 0) {
                city = geo[0].city || geo[0].region || geo[0].district;
                setCurrentCity(city);
            }
            const dist = await appendPoint(lat, lng, user);
            const route = await loadTodayRoute(user);
            setTodayPath(route);
            setDistance(dist);
            const [allCities, recs] = await Promise.all([fetchAllPollution(city), fetchRecords()]);
        } catch (e) {
            console.warn('[Teleop] Update failed:', e);
        }
    };
    const handleTeleopMove = (e) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        setTeleopPos({ latitude, longitude });
        updateSimulatedLocation(latitude, longitude);
    };
    const toggleTeleop = () => {
        if (!teleopMode) {
            setTeleopPos({ latitude: location.latitude, longitude: location.longitude });
        }
        setTeleopMode(!teleopMode);
    };
    const recenter = () => {
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                ...location,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05
            });
        }
    };
    const onCitySelect = (city) => {
        const coords = CITY_COORDS[city];
        if (coords) {
            const region = { ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 };
            mapRef.current.animateToRegion(region);
            if (teleopMode) {
                setTeleopPos(coords);
                updateSimulatedLocation(coords.latitude, coords.longitude);
            }
            setIsSearching(false);
            setSearch('');
        }
    };
    const filteredCities = Object.keys(CITY_COORDS).filter(city => {
        const matchesSearch = city.toLowerCase().includes(search.toLowerCase());
        const matchesRegion = selectedRegion === 'ALL' || REGIONS[selectedRegion].includes(city);
        return matchesSearch && matchesRegion;
    });
    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={location}
                customMapStyle={isDark ? darkMapStyle : []}
            >
                {}
                {!teleopMode && (
                    <Marker coordinate={location}>
                        <View style={styles.markerContainer}>
                            <View style={styles.markerPulse} />
                            <View style={styles.markerOuter}>
                                {user?.profile?.profileImage ? (
                                    <Image source={{ uri: user.profile.profileImage }} style={styles.markerAvatar} />
                                ) : (
                                    <View style={styles.markerDot} />
                                )}
                            </View>
                        </View>
                    </Marker>
                )}
                {}
                {teleopMode && teleopPos && (
                    <Marker
                        coordinate={teleopPos}
                        draggable
                        onDragEnd={handleTeleopMove}
                        title={language === 'ZH' ? "模擬控制" : "Simulated Control"}
                    >
                        <View style={styles.markerContainer}>
                            <View style={styles.markerPulse} />
                            <View style={[styles.markerOuter, { borderColor: '#56ab91' }]}>
                                {user?.profile?.profileImage ? (
                                    <Image source={{ uri: user.profile.profileImage }} style={styles.markerAvatar} />
                                ) : (
                                    <View style={[styles.markerDot, { backgroundColor: '#56ab91' }]} />
                                )}
                            </View>
                        </View>
                    </Marker>
                )}
                <Polyline
                    coordinates={todayPath}
                    strokeColor="#00D2FF"
                    strokeWidth={4}
                />
            </MapView>
            {}
            <View style={styles.header}>
                <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={isDark ? "#888" : "#666"} />
                    <TextInput
                        style={[styles.input, isDark && { color: '#fff' }]}
                        placeholder={language === 'ZH' ? "搜尋城市..." : "Search city..."}
                        placeholderTextColor={isDark ? "#555" : "#999"}
                        value={search}
                        onChangeText={(t) => { setSearch(t); setIsSearching(true); }}
                        onFocus={() => setIsSearching(true)}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearch(''); setIsSearching(false); }}>
                            <Ionicons name="close-circle" size={20} color="#ccc" />
                        </TouchableOpacity>
                    )}
                </BlurView>
            </View>
            {isSearching && (
                <BlurView intensity={95} tint={isDark ? "dark" : "light"} style={styles.searchResults}>
                    <View style={styles.regionFilter}>
                        {['ALL', 'NORTH', 'WEST', 'SOUTH', 'EAST'].map(r => (
                            <TouchableOpacity 
                                key={r} 
                                style={[styles.regBtn, selectedRegion === r && styles.regBtnActive]}
                                onPress={() => setSelectedRegion(r)}
                            >
                                <Text style={[styles.regBtnText, selectedRegion === r && styles.regBtnTextActive]}>{r}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <FlatList
                        data={filteredCities}
                        keyExtractor={item => item}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.cityItem} onPress={() => onCitySelect(item)}>
                                <Ionicons name="location-outline" size={18} color="#00D2FF" style={{ marginRight: 10 }} />
                                <Text style={[styles.cityItemText, isDark && { color: '#fff' }]}>{item}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </BlurView>
            )}
            {}
            <View style={styles.controls}>
                <TouchableOpacity 
                    style={[styles.controlBtn, teleopMode && { backgroundColor: '#00D2FF' }]} 
                    onPress={toggleTeleop}
                >
                    <Ionicons name={teleopMode ? "game-controller" : "game-controller-outline"} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={recenter}>
                    <Ionicons name="locate" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
            {}
            <View style={styles.statsOverlay}>
                <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.statsBadge}>
                    <Ionicons name="walk" size={20} color="#00D2FF" />
                    <Text style={[styles.statsText, isDark && { color: '#fff' }]}>
                        {distance.toFixed(2)} <Text style={styles.statsUnit}>KM</Text>
                    </Text>
                </BlurView>
            </View>
        </View>
    );
}
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];
const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { width, height },
    header: { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 20, overflow: 'hidden' },
    input: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '600' },
    searchResults: { position: 'absolute', top: 130, left: 20, right: 20, maxHeight: height * 0.5, borderRadius: 20, overflow: 'hidden', padding: 10, zIndex: 9 },
    regionFilter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 5 },
    regBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)' },
    regBtnActive: { backgroundColor: '#00D2FF' },
    regBtnText: { fontSize: 10, fontWeight: '900', color: '#888' },
    regBtnTextActive: { color: '#fff' },
    cityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    cityItemText: { fontSize: 14, fontWeight: '700' },
    controls: { position: 'absolute', bottom: 120, right: 20, gap: 10 },
    controlBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
    statsOverlay: { position: 'absolute', bottom: 120, left: 20 },
    statsBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, gap: 10, overflow: 'hidden' },
    statsText: { fontSize: 22, fontWeight: '900', color: '#121212' },
    statsUnit: { fontSize: 12, fontWeight: '700', color: '#00D2FF' },
    statsUnit: { fontSize: 12, fontWeight: '700', color: '#00D2FF' },
    markerContainer: { alignItems: 'center', justifyContent: 'center' },
    markerPulse: { position: 'absolute', width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0, 210, 255, 0.3)' },
    markerOuter: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#00D2FF', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
    markerAvatar: { width: 36, height: 36, borderRadius: 18 },
    markerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#00D2FF', borderWidth: 2, borderColor: '#fff' },
    teleopMarker: { shadowColor: '#00D2FF', shadowOpacity: 0.5, shadowRadius: 10 },
});
