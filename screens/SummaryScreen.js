import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Animated, Modal, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { fetchRecords } from '../services/api';
import { loadRouteByKey, computeDistanceKm, getWeeklyDistanceHistory, getTodayDistance, getDateKey } from '../services/trackStorage';
import { getLocalRecords } from '../services/historyStore';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
const { width } = Dimensions.get('window');
export default function SummaryScreen() {
  const { language, theme } = useSettings();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState([]);
  const [expandedDay, setExpandedDay] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState({ km: 0, avg: 0 });
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentCity, setCurrentCity] = useState(null);
  const getDayName = (dateStr) => {
    const days = language === 'ZH' ? ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const d = new Date(dateStr);
    return days[isNaN(d.getDay()) ? 0 : d.getDay()];
  };
  const normalizeCity = (name) => {
    if (!name) return "";
    return name.replace(/ City| County|市|縣/g, '').trim();
  };
  const getLocalDateStr = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const Y = d.getFullYear();
    const M = d.getMonth() + 1;
    const D = d.getDate();
    return `${Y}-${M < 10 ? '0' + M : M}-${D < 10 ? '0' + D : D}`;
  };
  const getHealthMeta = (avg) => {
    if (avg === 0) return { label: language === 'ZH' ? '無數據' : 'NO DATA', color: '#8E8E93' };
    if (avg <= 15.4) return { label: language === 'ZH' ? '優良' : 'EXCELLENT', color: '#34C759' };
    if (avg <= 35.4) return { label: language === 'ZH' ? '普通' : 'FAIR', color: '#FFCC00' };
    if (avg <= 54.4) return { label: language === 'ZH' ? '不佳' : 'POOR', color: '#FF9500' };
    return { label: language === 'ZH' ? '危害' : 'HAZARDOUS', color: '#FF3B30' };
  };
  const loadAllStats = useCallback(async () => {
    setLoading(true);
    try {
      let city = currentCity;
      if (!city) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
              let loc = await Location.getLastKnownPositionAsync({});
              if (!loc) loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              if (loc) {
                  const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                  if (geo && geo.length > 0) {
                      city = geo[0].city || geo[0].region || geo[0].district;
                      setCurrentCity(city);
                  }
              }
          }
      }
      const [remoteRecords, localRecords, distanceHistory, liveDistance] = await Promise.all([
        fetchRecords().catch(() => []),
        getLocalRecords(user).catch(() => []),
        getWeeklyDistanceHistory(user).catch(() => ({})),
        getTodayDistance(user).catch(() => 0)
      ]);
      const allMap = new Map();
      [...remoteRecords, ...localRecords].forEach(r => {
        if (r && r.timestamp && r.county) {
          allMap.set(`${r.county}_${r.timestamp}`, r);
        }
      });
      const mergedRecords = Array.from(allMap.values());
      const stats = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const Y = d.getFullYear();
        const M = d.getMonth() + 1;
        const D = d.getDate();
        const dateStr = `${Y}-${M < 10 ? '0' + M : M}-${D < 10 ? '0' + D : D}`;
        const displayDate = d.toLocaleDateString(language === 'ZH' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' });
        const isToday = (i === 0);
        const personalRecords = mergedRecords.filter(x => x.county === 'USER_PATH' && getLocalDateStr(x.timestamp) === dateStr);
        const hasPersonal = personalRecords.length > 0;
        let dayRecords = [];
        let isFallback = false;
        if (hasPersonal) {
          dayRecords = personalRecords;
        } else {
          dayRecords = mergedRecords.filter(r => {
            if (!r.timestamp || !r.county) return false;
            if (getLocalDateStr(r.timestamp) !== dateStr) return false;
            if (city) {
              return normalizeCity(r.county) === normalizeCity(city);
            }
            return true;
          });
          if (dayRecords.length === 0 && city) {
            dayRecords = mergedRecords.filter(r => getLocalDateStr(r.timestamp) === dateStr);
            if (dayRecords.length > 0) isFallback = true;
          }
        }
        let sum = 0; let peak = 0; let low = 999;
        const intervals = [
          { label: '00-06', sum: 0, count: 0 },
          { label: '06-12', sum: 0, count: 0 },
          { label: '12-18', sum: 0, count: 0 },
          { label: '18-24', sum: 0, count: 0 },
        ];
        dayRecords.forEach(r => {
          const v = parseFloat(r.pm25) || 0;
          sum += v;
          if (v > peak) peak = v;
          if (v < low) low = v;
          const hour = new Date(r.timestamp).getHours();
          const binIdx = Math.floor(hour / 6);
          if (binIdx >= 0 && binIdx < 4) {
            intervals[binIdx].sum += v;
            intervals[binIdx].count++;
          }
        });
        const chartData = intervals.map(bin => ({
          label: bin.label,
          avg: bin.count > 0 ? bin.sum / bin.count : 0
        }));
        const avgVal = dayRecords.length > 0 ? sum / dayRecords.length : 0;
        const key = getDateKey(d, user);
        const dayStr = `${Y}-${M}-${D}`;
        let kmVal = isToday ? liveDistance : (distanceHistory[dayStr] || 0);
        if (kmVal === 0 && !isToday) {
            const pts = await loadRouteByKey(key);
            kmVal = computeDistanceKm(pts);
        }
        stats.push({
          id: dateStr,
          date: displayDate,
          dayName: isToday ? (language === 'ZH' ? '今天' : 'TODAY') : getDayName(dateStr),
          avg: parseFloat(avgVal.toFixed(1)),
          peak: Math.round(peak),
          low: low === 999 ? 0 : low,
          km: kmVal,
          hits: dayRecords.length,
          intervals: chartData,
          isFallback,
          isPersonal: hasPersonal
        });
      }
      setDailyStats(stats);
      const totalKm = stats.reduce((s, x) => s + (x.km || 0), 0);
      const totalAvg = stats.length > 0 ? stats.reduce((s, x) => s + (x.avg || 0), 0) / stats.length : 0;
      setWeeklySummary({ km: totalKm, avg: totalAvg });
    } catch (err) {
      console.warn('[SummaryScreen] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [language, currentCity]);
  useFocusEffect(
    useCallback(() => {
      loadAllStats();
    }, [loadAllStats])
  );
  if (loading) {
    return (
      <View style={[styles.loadBox, isDark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#00D2FF" />
        <Text style={[styles.loadText, isDark && { color: '#888' }]}>{language === 'ZH' ? '正在編譯紀錄...' : 'Compiling History...'}</Text>
      </View>
    );
  }
  const today = dailyStats[0] || { km: 0, avg: 0, hits: 0, isPersonal: false, isFallback: false };
  return (
    <LinearGradient colors={isDark ? ['#121212', '#1C1C1E'] : ['#f0f8ff', '#ffffff']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.todayCard}>
          <LinearGradient colors={['#00D2FF', '#007AFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.todayGradient}>
            <View style={styles.todayHeader}>
              <Text style={styles.todayLabel}>{language === 'ZH' ? '今日狀態' : "TODAY'S STATUS"}</Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity onPress={() => setShowShareModal(true)}>
                  <Ionicons name="share-social-outline" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={loadAllStats}>
                  <Ionicons name="refresh-circle-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.todayMain}>
              <View>
                <Text style={styles.todayKm}>{today.km > 0 && today.km < 0.1 ? today.km.toFixed(2) : today.km.toFixed(1)}</Text>
                <Text style={styles.todayUnits}>{language === 'ZH' ? '步行公里' : 'KM WALKED'}</Text>
              </View>
              <View style={styles.todayDivider} />
              <View>
                <Text style={styles.todayAvg}>{today.avg.toFixed(1)}</Text>
                <Text style={styles.todayUnits}>{language === 'ZH' ? '平均 PM2.5' : 'AVG PM2.5'}</Text>
              </View>
            </View>
            <View style={styles.todayFooter}>
              <Text style={styles.todayRating}>{language === 'ZH' ? `狀況：${getHealthMeta(today.avg).label}` : `CONDITION: ${getHealthMeta(today.avg).label}`}</Text>
              <Text style={styles.cityLocation}>
                📍 {today.isPersonal ? (language === 'ZH' ? '個人足跡' : 'PERSONAL JOURNEY') : (currentCity || (language === 'ZH' ? '台灣 (全區)' : 'Taiwan (All)'))}
                {today.isFallback && ` (${language === 'ZH' ? '全區數據' : 'Global Fallback'})`}
              </Text>
            </View>
          </LinearGradient>
        </View>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{language === 'ZH' ? '歷史紀錄 (7天)' : 'HISTORY LOG (7D)'}</Text>
        {dailyStats.map((item) => {
          const meta = getHealthMeta(item.avg);
          const isExpanded = expandedDay === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => setExpandedDay(isExpanded ? null : item.id)}
              style={[styles.dayCard, isDark && styles.dayCardDark]}
            >
              <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.dayInner}>
                <View style={styles.dayRow}>
                  <View style={styles.dayDateBox}>
                    <Text style={[styles.dayName, isDark && styles.textDark]}>{item.dayName}</Text>
                    <Text style={[styles.dayDate, isDark && styles.hUnitDark]}>{item.date}</Text>
                  </View>
                  <View style={styles.daySummary}>
                    <Text style={[styles.dayKmRow, isDark && {color: '#aaa'}]}>{item.km > 0 && item.km < 0.1 ? item.km.toFixed(2) : item.km.toFixed(1)} km</Text>
                    <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                    <Text style={[styles.dayAvgText, { color: meta.color }]}>{item.avg.toFixed(1)}</Text>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDark ? "#555" : "#ccc"} />
                  </View>
                </View>
                {isExpanded && (
                  <View style={styles.details}>
                    <View style={styles.chartSection}>
                      <Text style={[styles.chartTitle, isDark && styles.hUnitDark]}>{language === 'ZH' ? '時段分析 (6小時)' : 'INTERVAL BREAKDOWN (6H)'}</Text>
                      <View style={styles.chartRow}>
                        {item.intervals.map((bin, bIdx) => {
                          const bMeta = getHealthMeta(bin.avg);
                          return (
                            <View key={bIdx} style={styles.barContainer}>
                              <View style={[styles.barTrack, isDark && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <View style={[
                                  styles.barFill,
                                  {
                                    height: `${Math.max(5, Math.min(100, (bin.avg / 60) * 100))}%`,
                                    backgroundColor: bMeta.color
                                  }
                                ]} />
                              </View>
                              <Text style={[styles.barLabel, isDark && styles.hUnitDark]}>{bin.label}</Text>
                              <Text style={[styles.barVal, isDark && styles.textDark]}>{bin.avg > 0 ? bin.avg.toFixed(1) : '-'}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    <View style={[styles.detailGrid, isDark && { borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                      <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, isDark && styles.hUnitDark]}>{language === 'ZH' ? '最高值' : 'PEAK'}</Text>
                        <Text style={[styles.detailVal, isDark && styles.textDark]}>{item.peak.toFixed(1)}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, isDark && styles.hUnitDark]}>{language === 'ZH' ? '最低值' : 'LOWEST'}</Text>
                        <Text style={[styles.detailVal, isDark && styles.textDark]}>{item.low.toFixed(1)}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, isDark && styles.hUnitDark]}>{language === 'ZH' ? '步數 (預估)' : 'STEPS (EST)'}</Text>
                        <Text style={[styles.detailVal, isDark && styles.textDark]}>{(item.km * 1350).toFixed(0)}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, isDark && styles.hUnitDark]}>{language === 'ZH' ? '樣本數' : 'SAMPLES'}</Text>
                        <Text style={[styles.detailVal, isDark && styles.textDark]}>{item.hits}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </BlurView>
            </TouchableOpacity>
          );
        })}
        <View style={styles.weeklySummaryBox}>
          <Text style={styles.weeklySummaryText}>WEEKLY TOTAL: {weeklySummary.km.toFixed(2)} KM | AVG {weeklySummary.avg.toFixed(1)} PM2.5</Text>
        </View>
        <View style={styles.spacer} />
      </ScrollView>
      <Modal visible={showShareModal} transparent animationType="fade" onRequestClose={() => setShowShareModal(false)}>
        <View style={styles.modalBackdrop}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.qrCard, isDark && styles.qrCardDark]}>
            <Text style={styles.qrTitle}>{language === 'ZH' ? '分享數據紀錄' : 'SHARE TELEMETRY'}</Text>
            <Text style={styles.qrSubtitle}>{language === 'ZH' ? '掃描 QR Code 同步您的環境數據' : 'SCAN TO SYNC PERSONAL DATA'}</Text>
            <View style={styles.qrWrapper}>
              <QRCode value={JSON.stringify({ km: today.km, avg: today.avg })} size={180} color="#333" backgroundColor="#fff" />
            </View>
            <View style={styles.qrStatsRow}>
              <View style={styles.qrStat}>
                <Text style={[styles.qrStatVal, isDark && {color: '#fff'}]}>{today.km.toFixed(1)}</Text>
                <Text style={styles.qrStatLabel}>KM</Text>
              </View>
              <View style={styles.qrStat}>
                <Text style={[styles.qrStatVal, isDark && {color: '#fff'}]}>{today.avg.toFixed(0)}</Text>
                <Text style={styles.qrStatLabel}>PM2.5</Text>
              </View>
            </View>
            <Text style={styles.qrFooterText}>BLUE SKY TELEMETRY • SYNC V1.0</Text>
            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setShowShareModal(false)}>
              <Text style={styles.qrCloseText}>{language === 'ZH' ? '關閉' : 'CLOSE'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#121212' },
  scroll: { padding: 20, paddingTop: 60 },
  loadBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadText: { marginTop: 15, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  todayCard: { borderRadius: 30, overflow: 'hidden', marginBottom: 30, elevation: 15, shadowColor: '#00D2FF', shadowOpacity: 0.3, shadowRadius: 20 },
  todayGradient: { padding: 25 },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  todayLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  todayMain: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginVertical: 10 },
  todayKm: { color: '#fff', fontSize: 42, fontWeight: '900' },
  todayAvg: { color: '#fff', fontSize: 42, fontWeight: '900' },
  todayUnits: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  todayDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  todayFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 15, alignItems: 'center', gap: 5 },
  todayRating: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  cityLocation: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { color: '#00D2FF', fontSize: 15, fontWeight: '900', letterSpacing: 2, marginBottom: 15, marginLeft: 5 },
  textDark: { color: '#fff' },
  hUnitDark: { color: '#666' },
  dayCard: { marginBottom: 15, borderRadius: 25, overflow: 'hidden', backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  dayCardDark: { backgroundColor: '#1C1C1E', elevation: 0, borderWidth: 1, borderColor: '#2C2C2E' },
  dayInner: { padding: 20 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayDateBox: { flex: 1 },
  dayName: { fontSize: 16, fontWeight: '900', color: '#121212' },
  dayDate: { fontSize: 10, color: '#999', fontWeight: '700', marginTop: 2 },
  daySummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dayAvgText: { fontSize: 18, fontWeight: '900' },
  dayKmRow: { fontSize: 12, fontWeight: '700', marginRight: 10, color: '#aaa' },
  details: { marginTop: 25, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 25 },
  chartSection: { marginBottom: 30 },
  chartTitle: { color: '#BBB', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 20, textAlign: 'center' },
  chartRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 110 },
  barContainer: { alignItems: 'center', width: 60 },
  barTrack: { width: 18, height: 70, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 9, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 9 },
  barLabel: { color: '#AAA', fontSize: 10, fontWeight: 'bold', marginTop: 10 },
  barVal: { color: '#222', fontSize: 12, fontWeight: '900', marginTop: 4 },
  detailGrid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 15, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 20 },
  detailItem: { width: '45%' },
  detailLabel: { color: '#BBB', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  detailVal: { color: '#222', fontSize: 18, fontWeight: '900', marginTop: 5 },
  weeklySummaryBox: { marginTop: 20, alignItems: 'center', opacity: 0.5 },
  weeklySummaryText: { color: '#00D2FF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  spacer: { height: 160 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrCard: { width: '85%', backgroundColor: '#fff', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20 },
  qrCardDark: { backgroundColor: '#1C1C1E', elevation: 0, borderWidth: 1, borderColor: '#333' },
  qrTitle: { color: '#00D2FF', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
  qrSubtitle: { color: '#888', fontSize: 10, fontWeight: '700', marginBottom: 25, letterSpacing: 1 },
  qrWrapper: { padding: 15, backgroundColor: '#fff', borderRadius: 20, elevation: 5, shadowColor: '#00D2FF', shadowOpacity: 0.1, shadowRadius: 10 },
  qrStatsRow: { flexDirection: 'row', gap: 40, marginTop: 30 },
  qrStat: { alignItems: 'center' },
  qrStatVal: { fontSize: 24, fontWeight: '900', color: '#333' },
  qrStatLabel: { fontSize: 10, color: '#AAA', fontWeight: 'bold' },
  qrFooterText: { color: '#BBB', fontSize: 10, fontWeight: '700', marginTop: 30 },
  qrCloseBtn: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20, backgroundColor: 'rgba(0,210,255,0.1)' },
  qrCloseText: { color: '#00D2FF', fontWeight: '900', fontSize: 12 },
});
