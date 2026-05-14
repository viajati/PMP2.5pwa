import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useSettings } from '../context/SettingsContext';
export default function RefinedLoader({ message = "THINKING" }) {
    const { isDark } = useSettings();
    const rotateAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.timing(rotateAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
        ).start();
    }, []);
    const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <View style={[styles.container, isDark && styles.containerDark]}>
            <View style={styles.ringWrapper}>
                <Animated.View style={[styles.ring, { transform: [{ rotate: rotation }] }]}>
                    <View style={styles.ringGlow} />
                </Animated.View>
                <View style={styles.centerDot} />
            </View>
            <View style={styles.platform}>
                <Text style={styles.message}>{message.toUpperCase()}</Text>
            </View>
        </View>
    );
}
const styles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center', padding: 80, backgroundColor: '#fff' },
    containerDark: { backgroundColor: '#121212' },
    ringWrapper: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
    ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: 'transparent', borderTopColor: '#00D2FF', borderRightColor: '#00D2FF' },
    ringGlow: { position: 'absolute', top: -3, right: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D2FF' },
    centerDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,210,255,0.3)' },
    platform: { marginTop: 30, paddingHorizontal: 20, paddingVertical: 8 },
    message: { fontSize: 10, fontWeight: '900', color: '#00D2FF', letterSpacing: 3, textAlign: 'center' }
});
