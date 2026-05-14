import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Ellipse } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
const { width } = Dimensions.get('window');
const RainDrop = () => {
    const anim = useRef(new Animated.Value(0)).current;
    const startX = useRef(Math.random() * width).current;
    useEffect(() => {
        const run = () => {
            anim.setValue(0);
            Animated.timing(anim, { toValue: 1, duration: 1000 + Math.random() * 500, delay: Math.random() * 2000, easing: Easing.linear, useNativeDriver: true }).start(() => run());
        };
        run();
    }, []);
    return (
        <Animated.View style={[
            styles.rainDrop,
            {
                left: startX,
                transform: [
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 500] }) },
                    { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) }
                ],
                opacity: anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.6, 0.6, 0] })
            }
        ]} />
    );
};
const WindLine = ({ y }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const run = () => {
            anim.setValue(0);
            Animated.timing(anim, { toValue: 1, duration: 1500 + Math.random() * 1000, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }).start(() => run());
        };
        run();
    }, []);
    return (
        <Animated.View style={[
            styles.windLine,
            {
                top: y,
                transform: [
                    { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-width, width + 50] }) },
                    { skewX: '-20deg' }
                ],
                opacity: anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 0.7, 0.7, 0] })
            }
        ]} />
    );
};
const BlowingLeaf = () => {
    const anim = useRef(new Animated.Value(0)).current;
    const startY = useRef(Math.random() * 300).current;
    useEffect(() => {
        const run = () => {
            anim.setValue(0);
            Animated.timing(anim, { toValue: 1, duration: 4000 + Math.random() * 2000, easing: Easing.linear, useNativeDriver: true }).start(() => run());
        };
        run();
    }, []);
    return (
        <Animated.View style={[
            styles.leaf,
            {
                top: startY,
                transform: [
                    { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-100, width + 100] }) },
                    { translateY: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 50, 0] }) },
                    { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) }
                ],
                opacity: anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.8, 0.8, 0] })
            }
        ]} />
    );
};
const BlinkingStar = ({ delay }) => {
    const anim = useRef(new Animated.Value(Math.random())).current;
    const x = useRef(Math.random() * width).current;
    const y = useRef(Math.random() * 250).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 1000 + Math.random() * 1000, delay, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0.2, duration: 1000 + Math.random() * 1000, useNativeDriver: true })
            ])
        ).start();
    }, []);
    return (
        <Animated.View style={[
            styles.star,
            { top: y, left: x, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0.2, 1], outputRange: [0.6, 1] }) }] }
        ]} />
    );
};
const PremiumCloud = ({ y, delay, scale }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const run = () => {
            anim.setValue(0);
            Animated.timing(anim, { toValue: 1, duration: 30000 + Math.random() * 10000, delay, easing: Easing.linear, useNativeDriver: true }).start(() => run());
        };
        run();
    }, []);
    return (
        <Animated.View style={[
            styles.cloudWrapper,
            {
                top: y,
                transform: [
                    { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-250, width + 150] }) },
                    { scale }
                ]
            }
        ]}>
            <Svg height="100" width="200" viewBox="0 0 100 50">
                <Path 
                    d="M25 40 Q25 40 25 40 A15 15 0 0 1 15 15 A20 20 0 0 1 50 10 A15 15 0 0 1 75 15 A15 15 0 0 1 85 35 A15 15 0 0 1 25 40" 
                    fill="rgba(255,255,255,0.95)" 
                />
                <Circle cx="35" cy="25" r="12" fill="rgba(255,255,255,0.6)" />
                <Circle cx="60" cy="22" r="10" fill="rgba(255,255,255,0.5)" />
            </Svg>
        </Animated.View>
    );
};
export default function WeatherBackground({ weather }) {
  const sunAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
        Animated.timing(sunAnim, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  if (!weather) {
      return (
        <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.container} />
      );
  }
  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 11;
  const isNight = hour >= 18 || hour < 5;
  const code = weather.weatherCode || 0;
  const speed = weather.windSpeed || 0;
  const isRainy = code >= 51; 
  const isCloudy = code === 3 || code === 45 || code === 48 || isRainy;
  const isSunny = code >= 0 && code <= 2;
  const isWindy = speed > 7 || weather.type === 'windy';
  const isNoon = hour >= 11 && hour < 18;
  const renderSun = (isSmall = false) => (
    <Animated.View style={[
        styles.sun, 
        isSmall && { transform: [{ scale: 0.5 }, { translateX: 200 }, { translateY: -100 }] },
        { transform: [{ rotate: sunAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }
    ]}>
        <Svg height="400" width="400" viewBox="0 0 100 100">
            <Defs>
                <SvgLinearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#FFF7AD" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#FFA900" stopOpacity="1" />
                </SvgLinearGradient>
            </Defs>
            <Circle cx="50" cy="50" r="22" fill="url(#sunGrad)" />
            {[...Array(12)].map((_, i) => (
                <Path 
                    key={i} 
                    d="M50 5 L50 20" 
                    stroke="#FFD700" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    opacity="0.6"
                    transform={`rotate(${i * 30} 50 50)`} 
                />
            ))}
        </Svg>
    </Animated.View>
  );
  const renderStars = () => (
    <View style={StyleSheet.absoluteFill}>
        {[...Array(20)].map((_, i) => <BlinkingStar key={i} delay={i * 200} />)}
    </View>
  );
  const renderRaining = () => (
    <View style={StyleSheet.absoluteFill}>
        {[...Array(60)].map((_, i) => <RainDrop key={i} />)}
    </View>
  );
  const renderCloudy = () => (
    <View style={StyleSheet.absoluteFill}>
        <PremiumCloud y={20} delay={0} scale={1.2} />
        <PremiumCloud y={80} delay={5000} scale={0.8} />
        <PremiumCloud y={140} delay={12000} scale={1.5} />
        <PremiumCloud y={50} delay={20000} scale={0.6} />
    </View>
  );
  const renderWindy = () => (
    <View style={StyleSheet.absoluteFill}>
        {[...Array(18)].map((_, i) => <WindLine key={`wl-${i}`} y={20 + (i * 25)} />)}
        {[...Array(10)].map((_, i) => <BlowingLeaf key={`bl-${i}`} />)}
    </View>
  );
  let bgColors = ['#4facfe', '#00f2fe']; 
  if (isNight) bgColors = ['#0f2027', '#203a43', '#2c5364']; 
  else if (isRainy) bgColors = ['#606c88', '#3f4c6b']; 
  else if (isCloudy) bgColors = ['#bdc3c7', '#2c3e50']; 
  else if (isNoon) bgColors = ['#4facfe', '#00f2fe']; 
  const isSunnyFallback = isSunny || code === 1;
  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      {isNight && renderStars()}
      {}
      {!isNight && isSunnyFallback && renderSun()}
      {!isNight && !isSunny && !isRainy && code !== 3 && code !== 45 && code !== 48 && (isMorning || isNoon) && renderSun(true)}
      {isRainy && renderRaining()}
      {(isCloudy || isSunnyFallback) && renderCloudy()}
      {isWindy && renderWindy()}
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' },
  sun: { position: 'absolute', top: -150, right: -100, shadowColor: '#FFA900', shadowRadius: 50, shadowOpacity: 0.6, elevation: 10 },
  rainDrop: { position: 'absolute', width: 2, height: 25, backgroundColor: 'rgba(0, 210, 255, 0.7)', borderRadius: 1, shadowColor: '#00D2FF', shadowRadius: 5, shadowOpacity: 0.8 },
  cloudWrapper: { position: 'absolute', opacity: 0.8, shadowColor: '#fff', shadowRadius: 20, shadowOpacity: 0.3 },
  windLine: { position: 'absolute', width: width * 0.9, height: 3, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 1.5, shadowColor: '#fff', shadowRadius: 10, shadowOpacity: 0.5 },
  leaf: { position: 'absolute', width: 8, height: 12, backgroundColor: 'rgba(255,255,255,0.7)', borderTopLeftRadius: 12, borderBottomRightRadius: 12, shadowColor: '#fff', shadowRadius: 5, shadowOpacity: 0.4 },
  star: { position: 'absolute', width: 3, height: 3, backgroundColor: '#fff', borderRadius: 1.5, shadowColor: '#fff', shadowRadius: 6, shadowOpacity: 1, elevation: 5 }
});
