import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
const AnimatedPath = Animated.createAnimatedComponent(Path);
const PollutionDial = ({ pm25, maxVal = 100 }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;
  const R = 56;
  const circumference = Math.PI * R; 
  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);
  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: Math.min(Math.max(pm25, 0), maxVal),
      friction: 8,
      tension: 30,
      useNativeDriver: false, 
    }).start();
  }, [pm25]);
  const getMeta = (v) => {
    if (v <= 15.4) return { label: 'EXCELLENT', c1: '#34C759', c2: '#11998e' };
    if (v <= 35.4) return { label: 'FAIR',      c1: '#FFCC00', c2: '#FF9500' };
    if (v <= 54.4) return { label: 'POOR',      c1: '#FF9500', c2: '#FF3B30' };
    return             { label: 'HAZARDOUS',    c1: '#FF3B30', c2: '#8e2de2' };
  };
  const meta = getMeta(pm25);
  const dashOffset = fillAnim.interpolate({
    inputRange: [0, maxVal],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  });
  const shimmerOffset = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circumference * 0.15], 
  });
  const arcPath = `M ${80 - R},90 A ${R},${R} 0 0,1 ${80 + R},90`;
  return (
    <View style={styles.container}>
      <View style={styles.dialBox}>
        <Svg height="110" width="160" viewBox="0 0 160 110">
          <Defs>
            <LinearGradient id="fillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={meta.c1} stopOpacity="1" />
              <Stop offset="100%" stopColor={meta.c2} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="rgba(0,0,0,0.04)" stopOpacity="1" />
              <Stop offset="100%" stopColor="rgba(0,0,0,0.08)" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {}
          <Path
            d={arcPath}
            stroke="rgba(200,210,220,0.5)"
            strokeWidth={16}
            fill="none"
            strokeLinecap="round"
          />
          {}
          <AnimatedPath
            d={arcPath}
            stroke="url(#fillGrad)"
            strokeWidth={16}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
          {}
          <AnimatedPath
            d={arcPath}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.08} ${circumference * 0.92}`}
            strokeDashoffset={shimmerOffset}
          />
        </Svg>
        <View style={styles.textOverlay}>
          <Text style={[styles.val, { color: meta.c1 }]}>{parseFloat(pm25).toFixed(1)}</Text>
          <Text style={styles.unit}>µg/m³ PM2.5</Text>
          <Text style={[styles.status, { color: meta.c1 }]}>{meta.label}</Text>
        </View>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  dialBox: { width: 160, height: 110, alignItems: 'center', justifyContent: 'center' },
  textOverlay: {
    position: 'absolute', top: 48, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  val: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  unit: { fontSize: 9, fontWeight: 'bold', color: '#888', marginTop: 2 },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 10 },
});
export default PollutionDial;
