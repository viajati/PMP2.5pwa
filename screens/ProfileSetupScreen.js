import React, { useState, useRef, useEffect, memo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, Platform, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
const { width, height } = Dimensions.get('window');
const HEALTH_CONDITIONS = [
    { id: 'asthma', label: 'Asthma', icon: 'medical', story: 'tending to your breath' },
    { id: 'dust', label: 'Dust Allergies', icon: 'snow', story: 'clearing the air' },
    { id: 'sensitivity', label: 'Air Sensitivity', icon: 'leaf', story: 'sensing the whispers' },
    { id: 'allergies', label: 'Pollen Allergies', icon: 'flower', story: 'protecting your peace' },
    { id: 'cardio', label: 'Heart Vitality', icon: 'heart', story: 'nurturing your rhythm' },
    { id: 'outdoor', label: 'Outdoor Worker', icon: 'construct', story: 'braving the sky' }
];
const AGE_LABELS = ['<18', '18-35', '36-60', '60+'];
const FloatingLeaf = memo(({ delay = 0, startPos = { x: 0, y: 0 } }) => {
    const moveAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(moveAnim, { toValue: 1, duration: 15000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, delay }),
                Animated.timing(moveAnim, { toValue: 0, duration: 0, useNativeDriver: true })
            ])
        ).start();
    }, []);
    const translateX = moveAnim.interpolate({ inputRange: [0, 1], outputRange: [startPos.x, startPos.x + 150] });
    const translateY = moveAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [startPos.y, startPos.y - 180, startPos.y - 480] });
    const rotate = moveAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });
    const opacity = moveAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.4, 0.4, 0] });
    return (
        <Animated.View style={[styles.leaf, { transform: [{ translateX }, { translateY }, { rotate }], opacity }]}>
            <Ionicons name="leaf" size={22} color="rgba(255,255,255,0.3)" />
        </Animated.View>
    );
});
export default function ProfileSetupScreen({ navigation, route }) {
    const { user, updateProfile } = useAuth();
    const { theme } = useSettings();
    const isDark = theme === 'dark';
    const isFromSettings = route.params?.fromSettings === true;
    const [ageLevel, setAgeLevel] = useState(user?.profile?.ageLevel || 0);
    const [conditions, setConditions] = useState(user?.profile?.conditions || []);
    const [activityLevel, setActivityLevel] = useState(user?.profile?.activityLevel || 0);
    const [fitnessLevel, setFitnessLevel] = useState(user?.profile?.fitnessLevel || 0);
    const [profileImage, setProfileImage] = useState(user?.profile?.profileImage || null);
    const boxAnims = [
        useRef(new Animated.Value(user?.profile?.ageLevel ? 1 : 0)).current,
        useRef(new Animated.Value(user?.profile?.conditions?.length > 0 ? 1 : 0)).current,
        useRef(new Animated.Value(user?.profile?.activityLevel > 0 ? 1 : 0)).current,
        useRef(new Animated.Value(user?.profile?.fitnessLevel > 0 ? 1 : 0)).current,
    ];
    useEffect(() => {
        if (ageLevel > 0) animateIn(0);
        if (conditions.length > 0) animateIn(1);
        if (activityLevel > 0) animateIn(2);
        if (fitnessLevel > 0) animateIn(3);
    }, [ageLevel, conditions, activityLevel, fitnessLevel]);
    const animateIn = (index) => {
        Animated.spring(boxAnims[index], { toValue: 1, friction: 8, useNativeDriver: true }).start();
    };
    const toggleCondition = (id) => {
        if (conditions.includes(id)) {
            setConditions(conditions.filter(c => c !== id));
        } else {
            setConditions([...conditions, id]);
        }
    };
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });
        if (!result.canceled) {
            setProfileImage(result.assets[0].uri);
        }
    };
    const handleSave = async () => {
        try {
            const profile = { ageLevel, conditions, activityLevel, fitnessLevel, profileImage, gender: 'Not Specified' };
            if (updateProfile) {
                await updateProfile(profile);
                if (isFromSettings) {
                    navigation.goBack();
                } else {
                    navigation.replace('MainTabs');
                }
            }
        } catch (e) { console.error(e); }
    };
    const getBoxStory = (index) => {
        if (index === 0) {
            if (ageLevel === 1) return "A young seedling, starting your journey.";
            if (ageLevel === 2) return "In the bloom of life, exploring with energy.";
            if (ageLevel === 3) return "A steady guardian, moving with purpose.";
            if (ageLevel === 4) return "A wise soul, observing with deep grace.";
            return "";
        }
        if (index === 1) {
            if (conditions.length === 0) return "Living with pure vitality and peace.";
            const texts = conditions.map(id => HEALTH_CONDITIONS.find(c => c.id === id)?.story).filter(Boolean);
            if (texts.length === 1) return `You are ${texts[0]} with gentle care.`;
            if (texts.length === 2) return `A soul ${texts[0]} while ${texts[1]}.`;
            const last = texts.pop();
            const prefix = texts.length >= 3 ? "Guardian of your path, " : "A soul ";
            return `${prefix}${texts.join(', ')} and ${last}.`;
        }
        if (index === 2) {
            if (activityLevel >= 3) return "Your spirit is vibrant, dancing with nature's wind.";
            if (activityLevel >= 2) return "You move with a balanced rhythm through the world.";
            return "You find stillness and peace in the quiet moments.";
        }
        if (fitnessLevel >= 3) return "You possess a soul that is unbreakable and firm.";
        if (fitnessLevel >= 2) return "Your resilience is growing steady and strong.";
        return "You are nurturing a gentle foundation of strength.";
    };
    const renderStoryBox = (index, title, icon) => {
        const scale = boxAnims[index].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
        const opacity = boxAnims[index];
        const isVitality = index === 1;
        const count = conditions.length;
        let fontSize = 11;
        let lineHeight = 15;
        if (isVitality) {
            if (count === 3) { fontSize = 10; lineHeight = 13; }
            else if (count === 4) { fontSize = 9.5; lineHeight = 12; }
            else if (count >= 5) { fontSize = 8.5; lineHeight = 11; }
        }
        return (
            <Animated.View style={[styles.statusBox, { opacity, transform: [{ scale }] }]}>
                <LinearGradient colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']} style={styles.boxGradient}>
                    <Ionicons name={icon} size={24} color="#fff" style={styles.boxIcon} />
                    <Text style={styles.boxTitle}>{title}</Text>
                    <Text style={[styles.boxStoryText, { fontSize, lineHeight }]}>
                        {getBoxStory(index)}
                    </Text>
                </LinearGradient>
            </Animated.View>
        );
    };
    return (
        <View style={[styles.container, isDark && styles.containerDark]}>
            <View style={styles.headerLayer}>
                <LinearGradient colors={['#4a11cb', '#2575fc']} style={StyleSheet.absoluteFill}>
                    {[...Array(10)].map((_, i) => (
                        <FloatingLeaf key={`leaf-${i}`} startPos={{ x: Math.random() * width, y: 420 }} delay={i * 1000} />
                    ))}
                </LinearGradient>
                <View style={styles.fixedHeader}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
                            {profileImage ? (
                                <Image source={{ uri: profileImage }} style={[styles.avatarImg, { borderRadius: 35 }]} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Ionicons name="person" size={30} color="#fff" />
                                </View>
                            )}
                            <View style={styles.cameraBadge}>
                                <Ionicons name="camera" size={12} color="#fff" />
                            </View>
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.greeting}>Hi, {user?.username || 'angel'}!</Text>
                            <Text style={styles.headerTitle}>Personalize</Text>
                        </View>
                    </View>
                    <View style={styles.boxesContainer}>
                        <View style={styles.boxesRow}>
                            {renderStoryBox(0, 'Era', 'calendar-outline')}
                            {renderStoryBox(1, 'Vitality', 'heart-outline')}
                        </View>
                        <View style={styles.boxesRow}>
                            {renderStoryBox(2, 'Lifestyle', 'walk-outline')}
                            {renderStoryBox(3, 'Soul', 'shield-checkmark-outline')}
                        </View>
                    </View>
                </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} style={{ zIndex: 1 }}>
                <View style={[styles.formCard, isDark && styles.formCardDark]}>
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Life Era ({AGE_LABELS[ageLevel - 1] || '?'})</Text>
                        <View style={[styles.sliderBox, isDark && styles.sliderBoxDark]}>
                            <Slider
                                style={{width: '100%', height: 50}}
                                minimumValue={1} maximumValue={4} step={1}
                                value={ageLevel} onValueChange={setAgeLevel}
                                minimumTrackTintColor="#56ab91" maximumTrackTintColor={isDark ? "#333" : "#eee"} thumbTintColor="#56ab91"
                            />
                            <View style={styles.sliderLabels}>
                                {AGE_LABELS.map(l => <Text key={l} style={[styles.sliderLabel, isDark && styles.textDark]}>{l}</Text>)}
                            </View>
                        </View>
                    </View>
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Health Whispers (Conditions)</Text>
                        <View style={styles.chipRow}>
                            {HEALTH_CONDITIONS.map(item => (
                                <TouchableOpacity 
                                    key={item.id} 
                                    style={[styles.chip, isDark && styles.chipDark, conditions.includes(item.id) && styles.chipActiveSecondary]} 
                                    onPress={() => toggleCondition(item.id)}
                                >
                                    <Ionicons name={item.icon} size={18} color={conditions.includes(item.id) ? "#fff" : "#56ab91"} style={{marginRight: 8}} />
                                    <Text style={[styles.chipText, isDark && styles.chipTextDark, conditions.includes(item.id) && styles.chipTextActive]}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Movement Flow (Activity)</Text>
                        <View style={[styles.sliderBox, isDark && styles.sliderBoxDark]}>
                            <Slider
                                style={{width: '100%', height: 50}}
                                minimumValue={1} maximumValue={3} step={1}
                                value={activityLevel} onValueChange={setActivityLevel}
                                minimumTrackTintColor="#56ab91" maximumTrackTintColor={isDark ? "#333" : "#eee"} thumbTintColor="#56ab91"
                            />
                            <View style={styles.sliderLabels}>
                                <Text style={[styles.sliderLabel, isDark && styles.textDark]}>Quiet</Text>
                                <Text style={[styles.sliderLabel, isDark && styles.textDark]}>Flow</Text>
                                <Text style={[styles.sliderLabel, isDark && styles.textDark]}>Vibrant</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Soul Strength (Fitness)</Text>
                        <View style={[styles.sliderBox, isDark && styles.sliderBoxDark]}>
                            <Slider
                                style={{width: '100%', height: 50}}
                                minimumValue={1} maximumValue={3} step={1}
                                value={fitnessLevel} onValueChange={setFitnessLevel}
                                minimumTrackTintColor="#ff717b" maximumTrackTintColor={isDark ? "#333" : "#eee"} thumbTintColor="#ff717b"
                            />
                            <View style={styles.sliderLabels}>
                                <Text style={[styles.sliderLabel, isDark && styles.textDark]}>Soft</Text>
                                <Text style={[styles.sliderLabel, isDark && styles.textDark]}>Steady</Text>
                                <Text style={[styles.sliderLabel, isDark && styles.textDark]}>Strong</Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                        <LinearGradient colors={['#6a11cb', '#2575fc']} style={styles.saveBtnGradient}>
                            <Text style={styles.saveBtnText}>
                                {isFromSettings ? 'Update My Profile' : 'Begin My Healthy Story'}
                            </Text>
                            <Ionicons name="leaf" size={24} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    containerDark: { backgroundColor: '#0f0f0f' },
    headerLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: 490, zIndex: 100, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15 },
    fixedHeader: { paddingHorizontal: 25, paddingTop: 60 },
    headerTop: { marginBottom: 15, flexDirection: 'row', alignItems: 'center', gap: 15 },
    avatarWrapper: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', overflow: 'visible' },
    avatarImg: { width: '100%', height: '100%', borderRadius: 35 },
    avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#56ab91', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    greeting: { fontSize: 22, color: '#fff', fontWeight: '900', textTransform: 'capitalize' },
    headerTitle: { fontSize: 36, color: '#fff', fontWeight: '900', marginTop: -5 },
    leaf: { position: 'absolute', zIndex: 1 },
    boxesContainer: { marginTop: 10 },
    boxesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    statusBox: { width: (width - 70) / 2, minHeight: 140, borderRadius: 25, overflow: 'hidden' },
    boxGradient: { flex: 1, padding: 12, alignItems: 'center', justifyContent: 'center' },
    boxIcon: { marginBottom: 6 },
    boxTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginBottom: 4, opacity: 0.8 },
    boxStoryText: { color: '#fff', textAlign: 'center' },
    scrollContent: { paddingTop: 490 },
    formCard: { backgroundColor: '#fff', padding: 30, paddingBottom: 80 },
    formCardDark: { backgroundColor: '#0f0f0f' },
    section: { marginBottom: 35 },
    sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1b4332', marginBottom: 18 },
    textDark: { color: '#fff' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { backgroundColor: '#f0fcf6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, borderWidth: 2, borderColor: '#dcf7e9', flexDirection: 'row', alignItems: 'center' },
    chipDark: { backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' },
    chipActiveSecondary: { backgroundColor: '#ff717b', borderColor: '#ff717b' },
    chipText: { fontSize: 14, color: '#409167', fontWeight: '900' },
    chipTextDark: { color: '#8E8E93' },
    chipTextActive: { color: '#fff' },
    sliderBox: { backgroundColor: '#f8fffb', padding: 18, borderRadius: 25, borderWidth: 1.5, borderColor: '#edf7f2' },
    sliderBoxDark: { backgroundColor: '#1C1C1E', borderColor: '#2C2C2E' },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, paddingHorizontal: 5 },
    sliderLabel: { fontSize: 11, color: '#2d6a4f', fontWeight: '900' },
    saveBtn: { marginTop: 15, borderRadius: 30, overflow: 'hidden', elevation: 20, shadowColor: '#6a11cb', shadowOpacity: 0.5, shadowRadius: 20 },
    saveBtnGradient: { height: 75, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 15 },
    saveBtnText: { color: '#fff', fontSize: 20, fontWeight: '900' }
});
