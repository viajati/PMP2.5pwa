"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  saveUserPreferences,
  subscribeUserPreferences,
} from "@/lib/firebaseData";
import { isAppVerifiedUser } from "@/lib/authStatus";

export const PREFS_KEY = "pmp25_setup_preferences";

export const DEFAULT_PREFS = {
  name: "",
  email: "",
  avatar: "",
  darkMode: true,
  chinese: false,
  notifications: true,
};

const AppPreferencesContext = createContext({
  prefs: DEFAULT_PREFS,
  updatePrefs: () => {},
  setPrefs: () => {},
  t: (en) => en,
});

function cleanPrefs(value = {}) {
  return Object.keys(DEFAULT_PREFS).reduce((nextPrefs, key) => {
    nextPrefs[key] = value[key] ?? DEFAULT_PREFS[key];
    return nextPrefs;
  }, {});
}

function accountName(user) {
  return user?.displayName?.trim() || "";
}

export function readPrefs() {
  if (typeof window === "undefined") return DEFAULT_PREFS;

  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? cleanPrefs(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(nextPrefs) {
  if (typeof window === "undefined") return;

  localStorage.setItem(PREFS_KEY, JSON.stringify(nextPrefs));
  window.dispatchEvent(new Event("pmp25:prefs-changed"));
}

export function AppPreferencesProvider({ children }) {
  const { user, firebaseReady } = useAuth();
  const [prefs, setPrefsState] = useState(DEFAULT_PREFS);
  const canSyncPrefs = Boolean(firebaseReady && user?.uid && isAppVerifiedUser(user));

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) setPrefsState(readPrefs());
    });

    function syncPrefs() {
      setPrefsState(readPrefs());
    }

    window.addEventListener("storage", syncPrefs);
    window.addEventListener("pmp25:prefs-changed", syncPrefs);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", syncPrefs);
      window.removeEventListener("pmp25:prefs-changed", syncPrefs);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.darkMode ? "dark" : "light";
    document.documentElement.dataset.lang = prefs.chinese ? "zh" : "en";
    document.documentElement.lang = prefs.chinese ? "zh-Hant" : "en";

    document.body.classList.toggle("theme-dark", prefs.darkMode);
    document.body.classList.toggle("theme-light", !prefs.darkMode);
  }, [prefs.darkMode, prefs.chinese]);

  useEffect(() => {
    if (!canSyncPrefs) return undefined;

    return subscribeUserPreferences(
      user.uid,
      (cloudPrefs) => {
        if (cloudPrefs) {
          const mergedPrefs = cleanPrefs(cloudPrefs);
          setPrefsState(mergedPrefs);
          writePrefs(mergedPrefs);
          return;
        }

        const localPrefs = readPrefs();
        const name = accountName(user) || localPrefs.name || "";
        const seededPrefs = {
          ...localPrefs,
          name,
          email: "",
          avatar: localPrefs.avatar || "",
        };

        setPrefsState(seededPrefs);
        writePrefs(seededPrefs);
        saveUserPreferences(user.uid, seededPrefs).catch((error) => {
          console.warn("Unable to seed cloud preferences:", error);
        });
      },
      (error) => {
        console.warn("Unable to subscribe to cloud preferences:", error);
      }
    );
  }, [canSyncPrefs, user]);

  const setPrefs = useCallback((nextPrefs) => {
    setPrefsState(nextPrefs);
    writePrefs(nextPrefs);

    if (canSyncPrefs) {
      saveUserPreferences(user.uid, nextPrefs).catch((error) => {
        console.warn("Unable to save cloud preferences:", error);
      });
    }
  }, [canSyncPrefs, user]);

  const updatePrefs = useCallback((patch) => {
    setPrefsState((current) => {
      const nextPrefs = {
        ...current,
        ...patch,
      };

      writePrefs(nextPrefs);

      if (canSyncPrefs) {
        saveUserPreferences(user.uid, nextPrefs).catch((error) => {
          console.warn("Unable to save cloud preferences:", error);
        });
      }

      return nextPrefs;
    });
  }, [canSyncPrefs, user]);

  const t = useCallback((en, zh) => {
    return prefs.chinese ? (zh ?? en) : en;
  }, [prefs.chinese]);

  const value = useMemo(
    () => ({
      prefs,
      setPrefs,
      updatePrefs,
      t,
    }),
    [prefs, setPrefs, updatePrefs, t]
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  return useContext(AppPreferencesContext);
}
