import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Switch, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
const { width } = Dimensions.get('window');
export default function SettingsScreen({ navigation }) {
    const { theme, language, notifications, toggleTheme, toggleLanguage, toggleNotifications, t } = useSettings();
    const { user, logout, updateProfile } = useAuth();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const isDark = theme === 'dark';
    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    }, []);
    const handleNotifToggle = async (val) => {
        if (val) {
            console.log('[Notifications] Requesting permissions...');
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            console.log('[Notifications] Existing status:', existingStatus);
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            console.log('[Notifications] Final status:', finalStatus);
            if (finalStatus !== 'granted') {
                Alert.alert("Permission Refused", "We need notification access to send you pollution alerts. Please enable it in Settings.");
                return;
            }
        }
        toggleNotifications(val);
    };
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });
        if (!result.canceled) {
            const newProfile = { ...(user?.profile || {}), profileImage: result.assets[0].uri };
            await updateProfile(newProfile);
        }
    };
    const SettingRow = ({ icon, label, sub, value, onValueChange, isToggle = true }) => (
        <View style={[styles.settingCard, isDark && styles.settingCardDark]}>
            <View style={[styles.iconBox, isDark && styles.iconBoxDark]}>
                <Ionicons name={icon} size={22} color="#00D2FF" />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={[styles.settingLabel, isDark && styles.settingLabelDark]}>{label}</Text>
                <Text style={[styles.settingSub, isDark && styles.settingSubDark]}>{sub}</Text>
            </View>
            {isToggle && (
                <Switch 
                    value={value} 
                    onValueChange={onValueChange}
                    trackColor={{ false: isDark ? "#333" : "#eee", true: "#00D2FF" }}
                    thumbColor="#fff"
                />
            )}
        </View>
    );
    return (
        <View style={[styles.container, isDark && styles.containerDark]}>
            <LinearGradient colors={isDark ? ['#121212', '#1C1C1E'] : ['#f8f9fa', '#e9ecef']} style={StyleSheet.absoluteFill} />
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <View style={styles.profileHero}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatar}>
                        {user?.profile?.profileImage ? (
                            <Image source={{ uri: user.profile.profileImage }} style={[StyleSheet.absoluteFill, { borderRadius: 50 }]} />
                        ) : (
                            <>
                                <Ionicons name="person" size={40} color="#fff" style={{ zIndex: 2 }} />
                                <LinearGradient colors={['#6A11CB', '#2575FC']} style={StyleSheet.absoluteFill} />
                            </>
                        )}
                        <View style={styles.avatarEditBadge}>
                            <Ionicons name="camera" size={10} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={[styles.userName, isDark && styles.textDark]}>{user?.name?.toUpperCase() || t('profile').toUpperCase()}</Text>
                    <Text style={styles.userStatus}>{user?.email?.toUpperCase() || 'FREE ACCOUNT'}</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
                    <Text style={[styles.sectionHeader, isDark && styles.headerDark]}>{t('setup').toUpperCase()}</Text>
                    <SettingRow 
                        icon={isDark ? "moon" : "sunny"} 
                        label={t('dark_mode')} 
                        sub={language === 'ZH' ? "夜間高對比度視圖" : "High contrast night view"}
                        value={isDark}
                        onValueChange={(v) => toggleTheme(v ? 'dark' : 'light')}
                    />
                    <SettingRow 
                        icon="language" 
                        label={t('chinese')} 
                        sub={language === 'ZH' ? "切換為英文界面" : "Switch to Traditional Chinese"}
                        value={language === 'ZH'}
                        onValueChange={(v) => toggleLanguage(v ? 'ZH' : 'EN')}
                    />
                    <Text style={[styles.sectionHeader, {marginTop: 30}, isDark && styles.headerDark]}>{t('data').toUpperCase()}</Text>
                    <SettingRow 
                        icon="notifications" 
                        label={t('alerts')} 
                        sub={language === 'ZH' ? "當數值超過50時通知" : "Notify when CAQI > 50"}
                        value={notifications}
                        onValueChange={handleNotifToggle}
                    />
                    <Text style={[styles.sectionHeader, {marginTop: 30}, isDark && styles.headerDark]}>{language === 'ZH' ? '個人健康配置' : 'HEALTH & ACTIVITY PROFILE'}</Text>
                    <TouchableOpacity 
                        style={[styles.settingCard, isDark && styles.settingCardDark]}
                        onPress={() => navigation.navigate('ProfileSetup', { fromSettings: true })}
                    >
                        <View style={[styles.iconBox, isDark && styles.iconBoxDark]}>
                            <Ionicons name="body" size={22} color="#00D2FF" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={[styles.settingLabel, isDark && styles.settingLabelDark]}>
                                {language === 'ZH' ? '編輯健康配置' : 'Edit Health Profile'}
                            </Text>
                            <Text style={[styles.settingSub, isDark && styles.settingSubDark]}>
                                {language === 'ZH' ? '更新您的身體狀況與活動量' : 'Update your body condition & activity'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={isDark ? "#444" : "#ccc"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dangerBtn} onPress={() => Alert.alert("Reset Cache", "Delete all local pollution history?")}>
                        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        <Text style={styles.dangerText}>{t('clear_cache')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.logoutBtn, isDark && styles.logoutBtnDark]} 
                        onPress={() => Alert.alert("Logout", "Are you sure you want to exit?", [{text: 'Cancel'}, {text: 'Logout', style: 'destructive', onPress: logout}])}
                    >
                        <Ionicons name="log-out-outline" size={20} color="#fff" />
                        <Text style={styles.logoutText}>LOGOUT SESSION</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.logoutBtn, { backgroundColor: '#00D2FF', marginTop: 15 }]} 
                        onPress={async () => {
                            await Notifications.scheduleNotificationAsync({
                                content: { title: "🧪 Test Notification", body: "If you see this, notifications are working!" },
                                trigger: null,
                            });
                        }}
                    >
                        <Ionicons name="notifications-outline" size={20} color="#fff" />
                        <Text style={styles.logoutText}>SEND TEST ALERT</Text>
                    </TouchableOpacity>
                    <View style={styles.versionBox}>
                        <Text style={styles.versionText}>BLUE SKY TELEMETRY v2.4.0</Text>
                        <Text style={styles.legalText}>Designed for moenv.gov.tw • Taiwan</Text>
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}
const styles = StyleSheet.create({
    container: { flex: 1 },
    containerDark: { backgroundColor: '#121212' },
    content: { flex: 1, padding: 25 },
    profileHero: { alignItems: 'center', marginVertical: 30 },
    avatar: { 
        width: 100, height: 100, borderRadius: 50, 
        backgroundColor: '#1C1C1E',
        alignItems: 'center', justifyContent: 'center', 
        marginBottom: 15, elevation: 20, 
        shadowColor: '#00D2FF', shadowOpacity: 0.4, shadowRadius: 15,
        borderWidth: 4, borderColor: '#fff',
        overflow: 'visible', position: 'relative'
    },
    avatarEditBadge: { 
        position: 'absolute', bottom: 2, right: 2, 
        backgroundColor: '#00D2FF', width: 28, height: 28, borderRadius: 14, 
        justifyContent: 'center', alignItems: 'center', 
        borderWidth: 3, borderColor: '#fff', zIndex: 10 
    },
    userName: { fontSize: 22, fontWeight: '900', color: '#2d3436', letterSpacing: 1 },
    userStatus: { fontSize: 10, fontWeight: '900', color: '#00D2FF', letterSpacing: 2, marginTop: 4 },
    sectionHeader: { fontSize: 12, fontWeight: '900', color: '#8e8e93', letterSpacing: 2, marginBottom: 15, marginLeft: 5 },
    settingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 22, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: {width:0, height:4} },
    settingCardDark: { backgroundColor: '#1C1C1E', shadowOpacity: 0.2 },
    iconBox: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(0,210,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    iconBoxDark: { backgroundColor: 'rgba(255,255,255,0.05)' },
    settingLabel: { fontSize: 15, fontWeight: '900', color: '#2d3436' },
    settingLabelDark: { color: '#fff' },
    settingSub: { fontSize: 11, color: '#8e8e93', marginTop: 2, fontWeight: '600' },
    settingSubDark: { color: '#666' },
    dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, padding: 15 },
    dangerText: { color: '#FF3B30', fontSize: 13, fontWeight: '900' },
    versionBox: { marginTop: 40, alignItems: 'center' },
    versionText: { fontSize: 10, fontWeight: '900', color: '#666', letterSpacing: 1 },
    legalText: { fontSize: 9, color: '#444', marginTop: 4, fontWeight: 'bold' },
    textDark: { color: '#fff' },
    headerDark: { color: 'rgba(0,210,255,0.6)' },
    logoutBtn: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, 
        marginTop: 40, padding: 18, borderRadius: 20, backgroundColor: '#6A11CB',
        elevation: 10, shadowColor: '#6A11CB', shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: {width:0, height:8}
    },
    logoutBtnDark: { backgroundColor: '#4a0ea3' },
    logoutText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 }
});
