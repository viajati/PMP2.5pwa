import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import WeatherBackground from './WeatherBackground';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
const { width, height } = Dimensions.get('window');
const WEATHER_THEMES = {
    sunny: { colors: ['#4facfe', '#00f2fe'], icon: 'sunny', k: 'sunny' },
    raining: { colors: ['#485563', '#29323c'], icon: 'rainy', k: 'raining' },
    cloudy: { colors: ['#757f9a', '#d7dde8'], icon: 'cloudy', k: 'cloudy' },
    windy: { colors: ['#134e5e', '#71b280'], icon: 'leaf', k: 'windy' }
};
const FloatingBubble = ({ label, value, color, delay = 0, size = 95, top = 0, left = 0 }) => {
    const floatAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: 1, duration: 2500 + delay, useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 0, duration: 2500 + delay, useNativeDriver: true })
            ])
        ).start();
    }, []);
    const translateY = floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -20]
    });
    return (
        <Animated.View style={[styles.bubble, { 
            width: size, 
            height: size, 
            position: 'absolute',
            top, 
            left,
            backgroundColor: 'rgba(255,255,255,0.25)', 
            transform: [{ translateY }] 
        }]}>
            <Text style={styles.bubbleLabel}>{label}</Text>
            <Text style={[styles.bubbleVal, color && {color}]}>{value}</Text>
        </Animated.View>
    );
};
export default function WeatherHeader({ weather, city, pm25 }) {
    const { t, theme: currentTheme } = useSettings();
    const isDark = currentTheme === 'dark';
    const hour = new Date().getHours();
    const isNight = hour >= 18 || hour < 5;
    const isMorning = hour >= 5 && hour < 12;
    const isNoon = hour >= 12 && hour < 18;
    if (!weather) {
        return (
            <View style={[styles.container, {backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'}]}>
                <View style={[styles.header, {backgroundColor: '#fff', borderRadius: 0, transform: []}]} />
            </View>
        );
    }
    const bottomBgolor = isDark ? '#121212' : '#FFFFFF';
    const transparentBg = isDark ? 'rgba(18,18,18,0)' : 'rgba(255,255,255,0)';
    let themeInfo = WEATHER_THEMES[weather?.type || 'sunny'];
    let gradColors = [...themeInfo.colors];
    if (weather?.type === 'sunny' || !weather?.type) {
        if (isNight) {
            gradColors = ['#040B1A', isDark ? '#121212' : '#0B1E3B'];
        } else if (isNoon) {
            gradColors = ['#FF512F', '#F09819'];
        } else {
            gradColors = ['#4facfe', '#00f2fe'];
        }
    } else {
        if (isNight) {
            gradColors = ['#040B1A', isDark ? '#121212' : '#0B1E3B'];
        }
    }
    const theme = { ...themeInfo, colors: gradColors };
    const pollutionScore = Math.max(0, Math.min(100, 100 - (pm25 * 1.5)));
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <LinearGradient colors={theme.colors} style={StyleSheet.absoluteFill} />
                <WeatherBackground weather={weather} />
                {}
                <LinearGradient 
                    colors={[transparentBg, transparentBg, bottomBgolor, bottomBgolor]} 
                    locations={[0, 0.4, 0.95, 1]}
                    style={{position: 'absolute', bottom: 0, width: '100%', height: '100%'}} 
                />
                <View style={styles.content}>
                    <Text style={styles.cityText}>{t(city).toUpperCase()}</Text>
                    <Text style={styles.tempText}>{Math.round(weather?.temp || 0)}°</Text>
                    <View style={styles.conditionRow}>
                        <Ionicons name={theme.icon} size={24} color="#fff" />
                        <Text style={styles.conditionText}>{theme.k === 'sunny' ? t('good') : t(theme.k)}</Text>
                    </View>
                    <View style={styles.bubblesArea}>
                        {}
                        <FloatingBubble label={t('pollution')} value={`${Math.round(pollutionScore)}%`} color="#00D2FF" size={80} top={-20} left={width * 0.05} delay={0} />
                        <FloatingBubble label={t('wind')} value={`${weather?.windSpeed || 0}km`} size={68} top={30} left={width * 0.40} delay={600} />
                        <FloatingBubble label={t('humidity')} value={`${weather?.humidity || 0}%`} size={72} top={-10} left={width * 0.70} delay={1200} />
                    </View>
                </View>
            </View>
        </View>
    );
}
const styles = StyleSheet.create({
    container: { width: '100%', height: height * 0.50, overflow: 'visible' },
    header: { 
        height: height * 0.47, 
        width: '100%', 
        overflow: 'hidden', 
        borderBottomLeftRadius: 0, 
        borderBottomRightRadius: 0,
    },
    content: { 
        flex: 1, 
        justifyContent: 'flex-start',
        alignItems: 'center', 
        paddingTop: 55,
    },
    cityText: { 
        color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2,
        textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10
    },
    tempText: { 
        color: '#fff', fontSize: 100, fontWeight: '200', marginVertical: -10,
        textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 15
    },
    conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 35 },
    conditionText: { 
        color: '#fff', fontSize: 20, fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5
    },
    bubblesArea: {
        width: width,
        height: 120,
        position: 'relative'
    },
    bubble: {
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        shadowColor: '#00D2FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 25,
        elevation: 15
    },
    bubbleLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: 'bold', marginBottom: 2 },
    bubbleVal: { color: '#fff', fontSize: 15, fontWeight: '900' }
});
