import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
const AuthContext = createContext();
const USERS_DB_KEY = 'users_database_v1';
const CURRENT_SESSION_KEY = 'current_user_session_v1';
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    initializeDB();
  }, []);
  const initializeDB = async () => {
    try {
      const dbStr = await AsyncStorage.getItem(USERS_DB_KEY);
      let db = dbStr ? JSON.parse(dbStr) : {};
      if (!db['angelinemarcellina63@gmail.com'] && !db['angel']) {
          const angelUser = {
              id: 'u_angel_001',
              username: 'angel',
              email: 'angelinemarcellina63@gmail.com',
              password: 'tes',
              name: 'Angeline',
              profile: {
                  age: '18-25',
                  gender: 'Female',
                  conditions: ['sensitivity', 'asthma'],
                  activityLevel: 2,
                  fitnessLevel: 1
              }
          };
          db['angelinemarcellina63@gmail.com'] = angelUser;
          db['angel'] = angelUser; 
          await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
      }
      const savedSession = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
      if (savedSession) {
        setUser(JSON.parse(savedSession));
      }
    } catch (e) {
      console.error('DB Init Error', e);
    } finally {
      setIsLoading(false);
    }
  };
  const login = async (identifier, password) => {
    const dbStr = await AsyncStorage.getItem(USERS_DB_KEY);
    const db = dbStr ? JSON.parse(dbStr) : {};
    const userData = db[identifier];
    if (userData && userData.password === password) {
      setUser(userData);
      await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(userData));
      return { success: true };
    } else {
      throw new Error('Invalid username/email or password');
    }
  };
  const signup = async (username, email, password) => {
    const dbStr = await AsyncStorage.getItem(USERS_DB_KEY);
    let db = dbStr ? JSON.parse(dbStr) : {};
    if (db[username] || db[email]) {
      throw new Error('User already exists');
    }
    const newUser = {
      id: `u_${Date.now()}`,
      username,
      email,
      password,
      name: username
    };
    db[username] = newUser;
    db[email] = newUser;
    await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
    setUser(newUser);
    await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(newUser));
    return { success: true, isNew: true };
  };
  const updateProfile = async (profileData) => {
    if (!user) return;
    const updatedUser = { ...user, profile: profileData };
    setUser(updatedUser);
    await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(updatedUser));
    const dbStr = await AsyncStorage.getItem(USERS_DB_KEY);
    let db = dbStr ? JSON.parse(dbStr) : {};
    db[user.username] = updatedUser;
    db[user.email] = updatedUser;
    await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
  };
  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
  };
  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => useContext(AuthContext);
