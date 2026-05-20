"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const PREFS_KEY = "pmp25_setup_preferences";

export const DEFAULT_PREFS = {
  name: "Angeline",
  email: "angelinemarcellina63@gmail.com",
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

export function readPrefs() {
  if (typeof window === "undefined") return DEFAULT_PREFS;

  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
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
  const [prefs, setPrefsState] = useState(DEFAULT_PREFS);

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

  const setPrefs = useCallback((nextPrefs) => {
    setPrefsState(nextPrefs);
    writePrefs(nextPrefs);
  }, []);

  const updatePrefs = useCallback((patch) => {
    setPrefsState((current) => {
      const nextPrefs = {
        ...current,
        ...patch,
      };

      writePrefs(nextPrefs);
      return nextPrefs;
    });
  }, []);

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
