import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { registerRootComponent } from 'expo';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, StatusBar, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import RecordsScreen from './screens/RecordsScreen';
import SummaryScreen from './screens/SummaryScreen';
import SettingsScreen from './screens/SettingsScreen';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './screens/AuthScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import { createStackNavigator } from '@react-navigation/stack';
import * as Notifications from 'expo-notifications';
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width * 0.94;
const TAB_WIDTH = TAB_BAR_WIDTH / 4;
const LiquidTabBar = ({ state, descriptors, navigation }) => {
  const { theme, t } = useSettings();
  const sliderPos = useRef(new Animated.Value(0)).current;
  const isDark = theme === 'dark';
  useEffect(() => {
    Animated.spring(sliderPos, {
      toValue: (state.index * TAB_WIDTH),
      useNativeDriver: true,
      bounciness: 12,
      speed: 10,
    }).start();
  }, [state.index]);
  return (
    <View style={[styles.tabBarWrapper, { shadowColor: isDark ? '#000' : '#00D2FF' }]}>
      <View style={[styles.tabBarMain, { backgroundColor: isDark ? '#1C1C1E' : '#ffffff', borderTopColor: isDark ? '#333' : 'rgba(0,210,255,0.08)' }]}>
        <Animated.View style={[styles.liquidIndicator, { transform: [{ translateX: sliderPos }] }]} />
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = t(route.name.toLowerCase());
          const scale = useRef(new Animated.Value(1)).current;
          const lift = useRef(new Animated.Value(0)).current;
          useEffect(() => {
            Animated.parallel([
              Animated.spring(scale, { toValue: isFocused ? 1.3 : 1, useNativeDriver: true }),
              Animated.spring(lift, { toValue: isFocused ? -22 : 0, useNativeDriver: true }),
            ]).start();
          }, [isFocused]);
          let iconName = 'map';
          if (route.name === 'Records') iconName = 'list';
          if (route.name === 'Summary') iconName = 'stats-chart';
          if (route.name === 'Settings') iconName = 'settings';
          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(route.name)}
              style={styles.tabItem}
            >
              <Animated.View style={{ transform: [{ scale }, { translateY: lift }] }}>
                <Ionicons 
                    name={iconName} 
                    size={22} 
                    color={isFocused ? '#00D2FF' : (isDark ? '#8E8E93' : '#8E8E93')} 
                    style={isFocused && styles.focusedIcon}
                />
              </Animated.View>
              {!isFocused && <Text style={[styles.tabItemLabel, { color: isDark ? '#666' : '#8E8E93' }]}>{label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
function MainStack() {
  const { theme, t } = useSettings();
  const isDark = theme === 'dark';
  return (
    <Tab.Navigator
      tabBar={props => <LiquidTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? '#1C1C1E' : '#f0f8ff', borderBottomWidth: 1, borderBottomColor: isDark ? '#333' : 'rgba(0,210,255,0.1)' },
        headerTintColor: '#00D2FF',
        headerTitleStyle: { fontWeight: '900', letterSpacing: 1.5 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('live_track'), headerShown: false }} />
      <Tab.Screen name="Records" component={RecordsScreen} options={{ title: t('archive') }} />
      <Tab.Screen name="Summary" component={SummaryScreen} options={{ title: t('stats') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings') }} />
    </Tab.Navigator>
  );
}
const AppContent = () => {
  const { theme } = useSettings();
  const { user, isLoading } = useAuth();
  const isDark = theme === 'dark';
  if (isLoading) return null;
  return (
    <View style={[styles.appContainer, { backgroundColor: isDark ? '#121212' : '#f0f8ff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <Stack.Screen name="Auth" component={AuthScreen} />
          ) : (
            <>
              {}
              <Stack.Screen name="MainTabs" component={MainStack} />
              {}
              <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};
export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SettingsProvider>
  );
}
const styles = StyleSheet.create({
  appContainer: { flex: 1 },
  tabBarWrapper: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    width: width, 
    backgroundColor: 'transparent',
    elevation: 30, 
    shadowOpacity: 0.15, 
    shadowRadius: 15, 
    shadowOffset: {width: 0, height: -5} 
  },
  tabBarMain: { 
    flexDirection: 'row', 
    height: 90, 
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    alignItems: 'center', 
    paddingBottom: 20,
    paddingHorizontal: 0, 
    overflow: 'visible',
    borderTopWidth: 1,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabItemLabel: { fontSize: 8, fontWeight: '900', marginTop: 4, letterSpacing: 0.5 },
  liquidIndicator: { 
    position: 'absolute', 
    width: 66, 
    height: 66, 
    left: (TAB_WIDTH - 66) / 2, 
    top: -10, 
    justifyContent: 'center',
    alignItems: 'center'
  },
  focusedIcon: { textShadowColor: 'rgba(255,255,255,0.4)', textShadowRadius: 10, marginLeft: 0 },
});
registerRootComponent(App);
