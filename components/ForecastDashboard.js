import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Polyline, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getWeeklySummary } from '../services/historyStore';
const { width } = Dimensions.get('window');
const predictNextDays = (dataValues, forwardDays = 7) => {
    if (!dataValues || dataValues.length === 0) return Array(forwardDays).fill(0);
    if (dataValues.length === 1) return Array(forwardDays).fill(dataValues[0]);
    const n = dataValues.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    dataValues.forEach((y, x) => { sumX += x; sumY += y; sumXY += x * y; sumXX += x * x; });
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return Array(forwardDays).fill(dataValues[dataValues.length - 1]);
    let slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    const baseline = sumY / n; 
    const lastX = dataValues.length - 1;
    const predictions = [];
    let currentPy = slope * lastX + intercept;
    for(let i = 1; i <= forwardDays; i++) {
        currentPy = currentPy + slope; 
        const diffToBaseline = baseline - currentPy;
        currentPy = currentPy + (diffToBaseline * 0.15); 
        slope = slope * 0.8;
        if (currentPy < 0.1) currentPy = 2; 
        predictions.push(Math.max(0.1, currentPy));
    }
    return predictions;
};
const getDayLabel = (offset, lang, short=true) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const enDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const zhDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const enFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const zhFull = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    if(!short) return (lang === 'ZH' ? zhFull : enFull)[d.getDay()] + ` ${d.getMonth()+1}/${d.getDate()}`;
    return (lang === 'ZH' ? zhDays : enDays)[d.getDay()];
};
const RingGauge = ({ val, label, subLabel, color = "#FFCC00" }) => {
    const size = 90;
    const stroke = 12;
    const radius = (size - stroke) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = (val / 100) * circumference;
    return (
        <View style={{ alignItems: 'center' }}>
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={size} height={size}>
                    <Defs>
                        <SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor={color} stopOpacity="1" />
                            <Stop offset="1" stopColor={color === '#FFCC00' ? '#FF9500' : '#4CAF50'} stopOpacity="1" />
                        </SvgLinearGradient>
                    </Defs>
                    <Circle stroke="#EDEDED" fill="none" cx={size/2} cy={size/2} r={radius} strokeWidth={stroke} />
                    <Circle stroke="url(#grad)" fill="none" cx={size/2} cy={size/2} r={radius} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
                </Svg>
                <View style={{ position: 'absolute', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#1a1a1a' }}>{Math.round(val)}%</Text>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#999' }}>{subLabel}</Text>
                </View>
            </View>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#1a1a1a', marginTop: 12, textAlign: 'center', minWidth: 100 }}>{label}</Text>
        </View>
    );
};
const AnimatedBubble = ({ size, top, right, bottom, left, delay = 0 }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 3500 + delay, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0, duration: 3500 + delay, useNativeDriver: true })
            ])
        ).start();
    }, []);
    const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
    const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.4] });
    return (
        <Animated.View style={[
            styles.bubble, 
            { width: size, height: size, top, right, bottom, left, opacity, transform: [{ scale }] }
        ]} />
    );
};
export default function ForecastDashboard({ city, setSelectedCity, pm25, pm10 = 15, co = 150, advice, user }) {
    const { isDark, language } = useSettings();
    const [region, setRegion] = useState("NORTH");
    const [trendAvg, setTrendAvg] = useState(0);
    const [trendPkg, setTrendPkg] = useState(null);
    const [lastFetchTime, setLastFetchTime] = useState('');
    const [activePoint, setActivePoint] = useState(null); 
    const basePm = pm25 > 0 ? pm25 : 13;
    const basePm10 = pm10 > 0 ? pm10 : 25;
    const baseCo = co > 0 ? co : 150;
    const caqi = Math.max(1, Math.min(100, Math.round(basePm * 1.46))); 
    const actualScore = Math.max(1, Math.min(100, 100 - (basePm * 1.1)));
    useEffect(() => {
        const fetchTrend = async () => {
            const summary = await getWeeklySummary(city, user);
            if (summary && summary.length > 0) {
                const total = summary.reduce((acc, curr) => acc + curr.avgPM25, 0);
                setTrendAvg(total / summary.length);
            } else {
                setTrendAvg(basePm); 
            }
            const p25 = summary.length > 0 ? summary.slice().reverse().map(h => h.avgPM25 || 15) : [15, 18, 14, 15, 13, 16, basePm];
            const p10Arr = summary.length > 0 ? summary.slice().reverse().map(h => h.avgPM10 || 20) : [25, 28, 24, 25, 23, 26, basePm10];
            const pCoArr = summary.length > 0 ? summary.slice().reverse().map(h => h.avgCO || 100) : [150, 180, 140, 150, 130, 160, baseCo];
            const predP25 = predictNextDays(p25, 7);
            const predP10 = predictNextDays(p10Arr, 7);
            const predCo = predictNextDays(pCoArr, 7);
            setTrendPkg({ p25, p10Arr, pCoArr, predP25, predP10, predCo });
            setLastFetchTime(new Date().toLocaleString());
        };
        fetchTrend();
    }, [city, basePm, basePm10, baseCo]);
    const predictedPm = basePm + ((trendAvg - basePm) * 0.4);
    const potentialScore = Math.min(100, Math.max(1, 100 - (predictedPm * 1.1)));
    const regions = {
        NORTH: ['Taipei City', 'New Taipei City', 'Keelung City', 'Taoyuan City', 'Hsinchu City', 'Hsinchu County'],
        WEST: ['Miaoli County', 'Taichung City', 'Changhua County', 'Nantou County', 'Yunlin County'],
        SOUTH: ['Chiayi City', 'Chiayi County', 'Tainan City', 'Kaohsiung City', 'Pingtung County'],
        EAST: ['Yilan County', 'Hualien County', 'Taitung County', 'Penghu County', 'Kinmen County', 'Lienchiang County']
    };
    const evaluateCondition = (val) => {
        if (val < 15) return { icon: 'sunny', color: '#FFD700', label: 'Healthy' };
        if (val < 35) return { icon: 'partly-sunny', color: isDark ? '#E0E0E0' : '#757F9A', label: 'Moderate' };
        return { icon: 'cloud', color: '#00D2FF', label: 'Poor' };
    };
    const handlePointTap = (val, x, y, idx) => {
        const fullDateStr = getDayLabel(idx, language, false); 
        const condition = evaluateCondition(val);
        setActivePoint({ val, x, y, fullDateStr, condition });
    };
    return (
        <ScrollView style={[styles.container, isDark && styles.containerDark]} showsVerticalScrollIndicator={false}>
            {}
            <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, isDark && {color: '#fff'}]}>CITY PREDICTION</Text>
                <View style={styles.timeClock}>
                    <Ionicons name="time-outline" size={10} color="#00D2FF" style={{marginRight: 4}} />
                    <Text style={styles.timeClockText}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
            </View>
            <View style={styles.regionRow}>
                {['NORTH', 'WEST', 'SOUTH', 'EAST'].map(r => (
                    <TouchableOpacity key={r} onPress={() => setRegion(r)} style={[styles.regBtn, isDark && {backgroundColor: '#222'}, region === r && (isDark ? styles.regBtnActiveBlue : styles.regBtnActive)]}>
                        <Text style={[styles.regText, region === r && {color: '#fff'}]}>{r}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityScroll}>
                {regions[region].map(c => (
                    <TouchableOpacity key={c} onPress={() => setSelectedCity(c)} style={[styles.cityChip, isDark && styles.cityChipDark, city === c && styles.cityChipActive]}>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.cityChipText, isDark && {color: '#ccc'}, city === c && {color: '#00D2FF'}]}>{c}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            {}
            <View style={styles.cardWrapper}>
                <LinearGradient colors={['#FFF9D2', '#FFF0B3', '#FFE066']} style={styles.pillCard}>
                    <View style={StyleSheet.absoluteFillObject}>
                        <AnimatedBubble size={140} top={-30} right={20} delay={0} />
                        <AnimatedBubble size={90} bottom={30} left={35} delay={500} />
                        <AnimatedBubble size={180} bottom={-60} right={-30} delay={1000} />
                    </View>
                    <View style={styles.heroRow}>
                        <View style={styles.caqiBox}>
                            <Text style={styles.caqiNum}>{caqi}</Text>
                            <Text style={styles.caqiLabel}>CAQI</Text>
                        </View>
                        <View style={styles.heroText}>
                            <View style={styles.statusPill}>
                                <Text style={styles.statusText}>{caqi < 35 ? 'HEALTHY' : 'MODERATE'}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.trackLabelRow}>
                         <Text style={styles.trackLabel}>Track Score</Text>
                         <View style={styles.line} />
                    </View>
                    <View style={styles.gaugeRow}>
                        <RingGauge val={actualScore} label="Actual (Now)" subLabel={actualScore > 60 ? "Good" : "Poor"} color={actualScore > 60 ? '#FFCC00' : '#FF3B30'} />
                        <Ionicons name="arrow-forward" size={24} color="#D1D1D1" />
                        <RingGauge val={potentialScore} label="Predicted (Tom.)" subLabel={potentialScore > 60 ? "Good" : "Poor"} color={potentialScore > 60 ? '#FF9500' : '#FF3B30'} />
                    </View>
                </LinearGradient>
            </View>
            {}
            {advice && (
                <View style={styles.glassWrapper}>
                    <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.glassBox}>
                        <View style={styles.glassHeader}>
                            <Ionicons name="sparkles" size={14} color={isDark ? "#00D2FF" : "#FF9500"} />
                            <Text style={[styles.glassHeaderText, isDark && {color: '#888'}]}>AI RECOMMENDATION</Text>
                        </View>
                        <Text style={[styles.glassText, isDark && {color: '#fff'}]}>{advice}</Text>
                    </BlurView>
                </View>
            )}
            {}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && {color: '#fff'}]}>{language === 'ZH' ? '實時數據 (現在)' : 'Live Metrics (Right Now)'}</Text>
            </View>
            <View style={styles.metricsGrid}>
                <View style={[styles.metricItem, isDark && styles.metricItemDark]}>
                    <Text style={[styles.mTitle, isDark && {color: '#fff'}]}>PM2.5</Text>
                    <Text style={[styles.mSub, isDark && {color: '#aaa'}]}>Fine{"\n"}Particles</Text>
                    <View style={styles.mValRow}>
                        <Text style={[styles.mVal, {color: '#34C759'}]}>{pm25.toFixed(0)}</Text>
                        <Feather name="sun" size={18} color="#34C759" />
                    </View>
                </View>
                <View style={[styles.metricItem, isDark && styles.metricItemDark]}>
                    <Text style={[styles.mTitle, isDark && {color: '#fff'}]}>PM10</Text>
                    <Text style={[styles.mSub, isDark && {color: '#aaa'}]}>Coarse Particulates</Text>
                    <View style={styles.mValRow}>
                        <Text style={[styles.mVal, {color: '#FFCC00'}]}>{Math.round(pm10)}</Text>
                        <Ionicons name="cloud-outline" size={18} color="#FFCC00" />
                    </View>
                </View>
                <View style={[styles.metricItem, isDark && styles.metricItemDark]}>
                    <Text style={[styles.mTitle, isDark && {color: '#fff'}]}>CO</Text>
                    <Text style={[styles.mSub, isDark && {color: '#aaa'}]}>Carbon Monoxide</Text>
                    <View style={styles.mValRow}>
                        <Text style={[styles.mVal, {color: '#34C759'}]}>{Math.round(co)}</Text>
                        <MaterialCommunityIcons name="leaf" size={18} color="#34C759" />
                    </View>
                </View>
            </View>
            {}
            {trendPkg ? (
                <>
                    <View style={[styles.sectionHeader, {marginTop: 35}]}>
                        <Text style={[styles.sectionTitle, isDark && {color: '#fff'}]}>{language === 'ZH' ? '未來局勢 (24小時預測)' : 'Future Scope (Tomorrow\'s Prediction)'}</Text>
                    </View>
                    <View style={[styles.unifiedBox, isDark && styles.unifiedBoxDark]}>
                        <View style={styles.yourCityGrid}>
                            <View style={[styles.gridItem, isDark && styles.gridBorderDark]}>
                                <Ionicons name="cloud-outline" size={20} color={isDark ? "#888" : "#999"} style={styles.gridIcon}/>
                                <Text style={[styles.gridVal, isDark && {color: '#fff'}]}>{trendPkg.predP25[0].toFixed(1)}</Text>
                                <Text style={styles.gridLabel}>PM 2.5</Text>
                            </View>
                            <View style={[styles.gridItem, isDark && styles.gridBorderDark]}>
                                <Ionicons name="analytics-outline" size={20} color={isDark ? "#888" : "#999"} style={styles.gridIcon}/>
                                <Text style={[styles.gridVal, isDark && {color: '#fff'}]}>{trendPkg.predP10[0].toFixed(1)}</Text>
                                <Text style={styles.gridLabel}>PM 10</Text>
                            </View>
                            <View style={[styles.gridItem, isDark && styles.gridBorderDark]}>
                                <Ionicons name="leaf-outline" size={20} color={isDark ? "#888" : "#999"} style={styles.gridIcon}/>
                                <Text style={[styles.gridVal, isDark && {color: '#fff'}]}>{trendPkg.predCo[0].toFixed(0)}</Text>
                                <Text style={styles.gridLabel}>CO2 / CO</Text>
                            </View>
                            <View style={[styles.gridItem, isDark && styles.gridBorderDark]}>
                                <Ionicons name="git-commit-outline" size={20} color={isDark ? "#888" : "#999"} style={styles.gridIcon}/>
                                <Text style={[styles.gridVal, isDark && {color: '#fff'}, {color: basePm > trendPkg.predP25[0] ? '#34C759': '#FF3B30'}]}>
                                    {basePm > trendPkg.predP25[0] ? '-'+(basePm - trendPkg.predP25[0]).toFixed(1) : '+'+(trendPkg.predP25[0] - basePm).toFixed(1)}
                                </Text>
                                <Text style={styles.gridLabel}>{language === 'ZH' ? '極端趨勢' : 'Drift Shift'}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, isDark && {color: '#fff'}]}>{language === 'ZH' ? '7天預測統計' : '7-Day Prediction Outlook (PM2.5)'}</Text>
                    </View>
                    <View style={[styles.unifiedBox, isDark && styles.unifiedBoxDark, {paddingTop: 20, paddingBottom: 30}]}>
                        {}
                        <View style={[styles.weekRow, {marginBottom: 20}]}>
                            {trendPkg.predP25.map((val, idx) => {
                                const cond = evaluateCondition(val);
                                return (
                                    <View key={idx} style={styles.weekItem}>
                                        <Text style={[styles.weekDay, isDark && {color: '#aaa'}]}>{getDayLabel(idx + 1, language)}</Text>
                                        <Ionicons name={cond.icon} size={20} color={cond.color} style={{ marginVertical: 8 }} />
                                        <Text style={[styles.weekCurrent, isDark && {color: '#fff'}]}>{val.toFixed(0)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                        {}
                        <View style={[styles.line, {width: '90%', alignSelf: 'center', marginVertical: 10, opacity: 0.3}]} />
                        <View style={styles.chartBox}>
                            <Svg width={width - 70} height={140} style={{ overflow: 'visible' }}>
                                {[0, 1, 2, 3, 4, 5, 6].map(i => {
                                     const x = 15 + (i / 6) * (width - 100);
                                     return <Line key={`grid-${i}`} x1={x} y1="10" x2={x} y2={130} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="1" />;
                                })}
                                <Polyline 
                                     points={[basePm, ...trendPkg.predP25.slice(0, 6)].map((val, idx) => {
                                         const x = 15 + (idx / 6) * (width - 100);
                                         const maxVal = Math.max(0.1, ...[basePm, ...trendPkg.predP25.slice(0, 6)]) * 1.6;
                                         const y = 15 + (100 - ((val / maxVal) * 100));
                                         return `${x},${y}`;
                                     }).join(' ')} 
                                     fill="none" stroke="#00D2FF" strokeWidth="2" 
                                />
                                {[basePm, ...trendPkg.predP25.slice(0, 6)].map((val, idx) => {
                                    const x = 15 + (idx / 6) * (width - 100);
                                    const maxVal = Math.max(0.1, ...[basePm, ...trendPkg.predP25.slice(0, 6)]) * 1.6;
                                    const y = 15 + (100 - ((val / maxVal) * 100));
                                    const isLast = idx === 6;
                                    const isSelected = activePoint && activePoint.x === x;
                                    return (
                                        <React.Fragment key={`dot-${idx}`}>
                                            {isLast && <Circle cx={x} cy={y} r="15" fill="rgba(0,210,255,0.2)" />}
                                            <Circle cx={x} cy={y} r={isSelected ? "6" : "4"} fill={isSelected ? '#FF9500' : (isDark ? '#333' : '#fff')} stroke={isSelected ? '#FF9500' : '#00D2FF'} strokeWidth="2" />
                                            <Circle cx={x} cy={y} r="20" fill="transparent" onPress={() => handlePointTap(val, x, y, idx)} />
                                        </React.Fragment>
                                    );
                                })}
                            </Svg>
                            {activePoint && (
                                <View style={[
                                    styles.tooltip, 
                                    isDark && styles.tooltipDark, 
                                    { left: Math.min(activePoint.x - 40, width - 150), top: activePoint.y - 65 }
                                ]}>
                                    <Text style={[styles.ttDate, isDark && {color: '#aaa'}]}>{activePoint.fullDateStr}</Text>
                                    <Text style={[styles.ttVal, {color: activePoint.condition.color}]}>{activePoint.val.toFixed(1)} µg/m³</Text>
                                </View>
                            )}
                        </View>
                        {lastFetchTime !== '' && (
                            <Text style={styles.predictedTimeLabel}>Last Predicted: {lastFetchTime}</Text>
                        )}
                    </View>
                </>
            ) : (
                <View style={{height: 300, justifyContent: 'center'}}>
                    <ActivityIndicator size="small" color="#00D2FF" />
                </View>
            )}
            <View style={{height: 50}} />
        </ScrollView>
    );
}
const styles = StyleSheet.create({
    container: { padding: 20 },
    containerDark: { backgroundColor: '#121212' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 11, fontWeight: '900', color: '#1a1a1a', letterSpacing: 1.5 },
    timeClock: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,210,255,0.08)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
    timeClockText: { color: '#00D2FF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    regionRow: { flexDirection: 'row', gap: 6, marginBottom: 15 },
    regBtn: { flex: 1, backgroundColor: '#f0f0f0', paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
    regBtnActive: { backgroundColor: '#121212' },
    regBtnActiveBlue: { backgroundColor: '#00D2FF' },
    regText: { fontSize: 9, fontWeight: '900', color: '#999' },
    cityScroll: { gap: 10, paddingBottom: 20 },
    cityChip: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eee' },
    cityChipDark: { backgroundColor: '#1e1e1e', borderColor: '#333' },
    cityChipActive: { borderColor: '#00D2FF', borderWidth: 1.5 },
    cityChipText: { fontSize: 12, fontWeight: '800', color: '#777' },
    cardWrapper: { alignItems: 'flex-start', width: '100%', marginBottom: 30 },
    pillCard: { 
        width: width * 0.95, 
        marginLeft: -20,
        backgroundColor: '#FDFCF6', 
        borderTopLeftRadius: 0, 
        borderBottomLeftRadius: 0, 
        borderTopRightRadius: 180, 
        borderBottomRightRadius: 180, 
        padding: 35, 
        paddingRight: 60,
        elevation: 6,
        shadowColor: '#FF9500', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 15,
        overflow: 'hidden'
    },
    bubble: { position: 'absolute', backgroundColor: '#FFF6D9', borderRadius: 999, shadowColor: '#FFCC00', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20 },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 25 },
    caqiBox: { alignItems: 'center' },
    caqiNum: { fontSize: 85, fontWeight: '900', color: '#1a1a1a', lineHeight: 90 },
    caqiLabel: { fontSize: 18, fontWeight: '900', color: '#1a1a1a' },
    heroText: { flex: 1, paddingLeft: 10 },
    heroTitle: { fontSize: 20, fontWeight: '900', color: '#1a1a1a', lineHeight: 24 },
    statusPill: { backgroundColor: '#E8F5E9', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start', marginTop: 10 },
    statusText: { fontSize: 10, fontWeight: '900', color: '#4CAF50' },
    trackLabelRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 35, gap: 12 },
    trackLabel: { fontSize: 14, fontWeight: '900', color: '#1a1a1a' },
    line: { flex: 0.6, height: 1.5, backgroundColor: '#EDEDED' },
    gaugeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    glassWrapper: { width: '100%', marginBottom: 25, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    glassBox: { padding: 20 },
    glassHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    glassHeaderText: { fontSize: 10, fontWeight: '900', color: '#666', letterSpacing: 1 },
    glassText: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', lineHeight: 20 },
    metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    metricItem: { flex: 1, backgroundColor: '#f8f9fa', borderRadius: 25, padding: 18, elevation: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
    metricItemDark: { backgroundColor: '#1C1C1E', borderColor: 'rgba(255,255,255,0.05)' },
    mTitle: { fontSize: 12, fontWeight: '900', color: '#1a1a1a' },
    mSub: { fontSize: 8, fontWeight: '700', color: '#999', marginVertical: 4 },
    mValRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    mVal: { fontSize: 24, fontWeight: '900' },
    unifiedBox: { backgroundColor: '#f8f9fa', borderRadius: 25, marginBottom: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
    unifiedBoxDark: { backgroundColor: '#1C1C1E', borderColor: 'rgba(255,255,255,0.05)' },
    sectionHeader: { marginBottom: 15, marginTop: 5 },
    sectionTitle: { color: '#333', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
    yourCityGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 5 },
    gridItem: { width: '50%', padding: 20, alignItems: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    gridBorderDark: { borderColor: 'rgba(255,255,255,0.05)' },
    gridIcon: { marginBottom: 10 },
    gridVal: { color: '#1a1a1a', fontSize: 20, fontWeight: 'bold' },
    gridLabel: { color: '#999', fontSize: 10, marginTop: 5, fontWeight: 'bold' },
    weekRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 5 },
    weekItem: { alignItems: 'center' },
    weekDay: { color: '#666', fontSize: 10, fontWeight: 'bold' },
    weekCurrent: { color: '#333', fontSize: 14, fontWeight: 'bold', marginTop: 5 },
    chartBox: { marginTop: 20, paddingHorizontal: 15, position: 'relative' },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, marginLeft: -5, marginRight: -5 },
    chartLabelText: { color: '#666', fontSize: 10, fontWeight: '900', width: 25, textAlign: 'center' },
    predictedTimeLabel: { textAlign: 'center', fontSize: 9, color: '#999', marginTop: 15, fontWeight: 'bold', letterSpacing: 1 },
    tooltip: {
        position: 'absolute',
        backgroundColor: '#fff',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 15,
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: {height: 5}, elevation: 15,
        zIndex: 10,
        minWidth: 90,
        alignItems: 'center'
    },
    tooltipDark: { backgroundColor: '#222', borderWidth: 1, borderColor: '#444' },
    ttDate: { fontSize: 11, fontWeight: '900', color: '#666', marginBottom: 5 },
    ttVal: { fontSize: 16, fontWeight: '900' }
});
