import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, Easing, Dimensions, KeyboardAvoidingView, Platform, Alert, ScrollView, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import * as Location from 'expo-location';
import WeatherBackground from '../components/WeatherBackground';
import { fetchWeather } from '../services/weather';
const { width, height } = Dimensions.get('window');
export default function AuthScreen({ navigation }) {
  const { login, signup } = useAuth();
  const { language } = useSettings();
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localWeather, setLocalWeather] = useState({ type: 'sunny', weatherCode: 1 });
  const [cityName, setCityName] = useState('Hsinchu City');
  const [currentTime, setCurrentTime] = useState(new Date());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();
    fetchInitialWeather();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isLogin]);
  const fetchInitialWeather = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const weatherData = await fetchWeather(loc.coords.latitude, loc.coords.longitude);
        if (weatherData) setLocalWeather(weatherData);
        const geo = await Location.reverseGeocodeAsync({ 
          latitude: loc.coords.latitude, 
          longitude: loc.coords.longitude 
        });
        if (geo && geo.length > 0) {
            const city = geo[0].city || geo[0].region;
            if (city) setCityName(city);
        }
      }
    } catch (e) {
      console.warn('Initial load failed', e);
    }
  };
  const getTimeString = () => {
    const hh = currentTime.getHours().toString().padStart(2, '0');
    const mm = currentTime.getMinutes().toString().padStart(2, '0');
    const ss = currentTime.getSeconds().toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };
  const getDateString = () => {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return currentTime.toLocaleDateString(language === 'ZH' ? 'zh-TW' : 'en-US', options);
  };
  const getAuthenticText = () => {
    const weather = localWeather?.type || 'sunny';
    const city = cityName;
    if (language === 'ZH') {
        switch(weather) {
            case 'raining': return `現在 ${city}\n正在下雨。`;
            case 'cloudy': return `${city} 的天空\n目前多雲。`;
            case 'windy': return `${city} 現在\n風很大。`;
            case 'storm': return `${city} 有雷陣雨\n注意安全。`;
            default: return `現在 ${city}\n陽光燦爛。`;
        }
    } else {
        switch(weather) {
            case 'raining': return `It's raining\nin ${city}\nright now.`;
            case 'cloudy': return `The sky is\ncloudy in ${city}.`;
            case 'windy': return `It's quite\nwindy in ${city}.`;
            case 'storm': return `Thunderstorms\nin ${city}\nStay safe.`;
            default: return `It's beautifully\nsunny in ${city}.`;
        }
    }
  };
  const handleAction = async () => {
    if (isLogin) {
        if (!identifier || !password) {
            Alert.alert(language === 'ZH' ? '錯誤' : 'Error', language === 'ZH' ? '請填寫帳號與密碼' : 'Please enter identifier and password');
            return;
        }
    } else {
        if (!username || !email || !password) {
            Alert.alert(language === 'ZH' ? '錯誤' : 'Error', language === 'ZH' ? '請填寫所有欄位' : 'Please fill all fields');
            return;
        }
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(identifier, password);
      } else {
        const result = await signup(username, email, password);
        if (result && result.isNew) {
            navigation.navigate('ProfileSetup');
        }
      }
    } catch (e) {
      Alert.alert(language === 'ZH' ? '登入失敗' : 'Login Failed', e.message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <View style={styles.container}>
      <WeatherBackground 
        weather={localWeather && typeof localWeather === 'object' ? localWeather : { type: 'sunny', weatherCode: 1 }} 
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40} 
      >
        <ScrollView 
            contentContainerStyle={{ flexGrow: 1 }} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
              <Text style={styles.authenticText}>{getAuthenticText()}</Text>
              <View style={styles.statusDivider} />
              <View style={styles.detailsRow}>
                  <View>
                      <Text style={styles.liveClock}>{getTimeString()}</Text>
                      <Text style={styles.dateText}>{getDateString()}</Text>
                  </View>
                  <View style={styles.locationBadge}>
                      <Ionicons name="location-sharp" size={14} color="#fff" />
                      <Text style={styles.locationBadgeText}>{cityName}</Text>
                  </View>
              </View>
            </Animated.View>
            <View style={styles.card}>
              <View style={[styles.form, { paddingBottom: 50 }]}>
                <Text style={styles.cardTitle}>
                  {isLogin ? (language === 'ZH' ? '登入賬戶' : 'Log In') : (language === 'ZH' ? '創建賬戶' : 'Sign Up')}
                </Text>
                {isLogin ? (
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      placeholder={language === 'ZH' ? '用戶名或電子郵件' : "Username or Email"}
                      placeholderTextColor="#999"
                      style={styles.input}
                      autoCapitalize="none"
                      value={identifier}
                      onChangeText={setIdentifier}
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        placeholder={language === 'ZH' ? '用戶名' : "Username"}
                        placeholderTextColor="#999"
                        style={styles.input}
                        autoCapitalize="none"
                        value={username}
                        onChangeText={setUsername}
                      />
                    </View>
                    <View style={styles.inputContainer}>
                      <Ionicons name="at-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        placeholder={language === 'ZH' ? '電子郵件' : "Email Address"}
                        placeholderTextColor="#999"
                        style={styles.input}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                      />
                    </View>
                  </>
                )}
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    placeholder={language === 'ZH' ? '密碼' : "Password"}
                    placeholderTextColor="#999"
                    style={styles.input}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>
                <TouchableOpacity style={styles.button} onPress={handleAction} disabled={isLoading}>
                  <LinearGradient colors={['#FFC3A0', '#FFAFBD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                    <Text style={styles.btnText}>
                      {isLoading 
                          ? (language === 'ZH' ? '處理中...' : 'PROCEEDING...') 
                          : (isLogin ? (language === 'ZH' ? '立即登入' : 'LOG IN') : (language === 'ZH' ? '立即註冊' : 'REGISTER'))}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toggle} onPress={() => setIsLogin(!isLogin)}>
                  <Text style={styles.toggleText}>
                    {isLogin 
                      ? (language === 'ZH' ? '還沒有帳戶？ ' : 'No account? ') 
                      : (language === 'ZH' ? '已經有帳戶？ ' : 'Already have an account? ')}
                    <Text style={styles.toggleLink}>
                      {isLogin ? (language === 'ZH' ? '註冊' : 'Register') : (language === 'ZH' ? '登入' : 'Login')}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { minHeight: height, justifyContent: 'space-between' },
  header: { padding: 40, paddingTop: height * 0.12 },
  authenticText: { 
    color: '#fff', 
    fontSize: 44, 
    fontWeight: '900', 
    lineHeight: 54, 
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8
  },
  statusDivider: { width: 50, height: 5, backgroundColor: '#fff', marginTop: 25, marginBottom: 25, borderRadius: 3 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveClock: { 
    color: '#fff', 
    fontSize: 32, 
    fontWeight: '900', 
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6
  },
  dateText: { 
    color: 'rgba(255,255,255,1)', 
    fontSize: 14, 
    fontWeight: '700', 
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  locationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 25 },
  locationBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 6 },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 45, borderTopRightRadius: 45, paddingHorizontal: 40, paddingVertical: 45, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  form: { gap: 15 },
  cardTitle: { fontSize: 24, fontWeight: '900', color: '#1a1a1a', marginBottom: 10, letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 18, paddingHorizontal: 20, height: 64, borderWidth: 1.5, borderColor: '#f1f3f5' },
  inputIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, color: '#1a1a1a', fontWeight: '700' },
  button: { marginTop: 10, height: 64, borderRadius: 18, overflow: 'hidden', elevation: 5 },
  btnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 2 },
  toggle: { marginTop: 15, alignItems: 'center' },
  toggleText: { color: '#999', fontSize: 14, fontWeight: '600' },
  toggleLink: { color: '#6A11CB', fontWeight: '900' },
});
