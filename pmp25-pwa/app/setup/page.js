"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Camera,
  ChevronRight,
  Languages,
  LogOut,
  Moon,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import OriginalBottomNav from "@/components/OriginalBottomNav";
import { useAppPreferences } from "@/components/AppPreferencesProvider";

const STORAGE_KEY = "pmp25_setup_preferences";

const DEFAULT_PREFS = {
  name: "Angeline",
  email: "angelinemarcellina63@gmail.com",
  avatar: "",
  darkMode: true,
  chinese: false,
  notifications: true,
};

function loadPrefs() {
  if (typeof window === "undefined") return DEFAULT_PREFS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(nextPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPrefs));
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "toggle-switch",
        checked ? "toggle-switch-checked" : "",
      ].join(" ")}
    >
      <span
        className="toggle-switch-thumb"
      />
    </button>
  );
}

function SettingRow({
  icon: Icon,
  title,
  subtitle,
  right,
  href,
  onClick,
}) {
  const content = (
    <>
      <div className="settings-row-icon">
        <Icon size={22} strokeWidth={2.7} />
      </div>

      <div className="settings-row-copy">
        <p className="settings-row-title">
          {title}
        </p>
        <p className="settings-row-subtitle">
          {subtitle}
        </p>
      </div>

      {right}
    </>
  );

  const className = "settings-row";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}


export default function SetupPage() {
  const { prefs: globalPrefs, updatePrefs: updateGlobalPrefs } = useAppPreferences();
  const fileRef = useRef(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [draft, setDraft] = useState(DEFAULT_PREFS);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const loaded = loadPrefs();
      setPrefs(loaded);
      setDraft(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function updatePrefs(patch) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setDraft(next);
    savePrefs(next);
    updateGlobalPrefs(patch);
  }

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function saveProfileIdentity() {
    const cleanName = draft.name.trim() || DEFAULT_PREFS.name;
    const cleanEmail = draft.email.trim() || DEFAULT_PREFS.email;

    updatePrefs({
      name: cleanName,
      email: cleanEmail,
    });

    setStatus("Profile name and Gmail/email saved.");
  }

  function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      updatePrefs({ avatar: reader.result });
      setStatus("Profile photo updated.");
    };

    reader.readAsDataURL(file);
  }

  async function toggleNotifications(value) {
    if (value && typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        updatePrefs({ notifications: false });
        setStatus("Notification permission was not granted.");
        return;
      }
    }

    updatePrefs({ notifications: value });
    setStatus(value ? "Pollution alerts enabled." : "Pollution alerts disabled.");
  }

  async function sendTestAlert() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus("Browser notifications are not supported.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      setStatus("Please allow notifications first.");
      return;
    }

    new Notification("🧪 Test Notification", {
      body: "If you see this, notifications are working!",
    });

    setStatus("Test notification sent.");
  }

  function clearHistory() {
    const ok = window.confirm("Clear local route and history cache?");
    if (!ok) return;

    Object.keys(localStorage).forEach((key) => {
      if (
        key.includes("pmp25") ||
        key.includes("route") ||
        key.includes("poll") ||
        key.includes("history")
      ) {
        localStorage.removeItem(key);
      }
    });

    savePrefs(DEFAULT_PREFS);
    setPrefs(DEFAULT_PREFS);
    setDraft(DEFAULT_PREFS);
    setStatus("History cache cleared.");
  }

  function logout() {
    const ok = window.confirm("Logout this local session?");
    if (!ok) return;
    setStatus("Logged out locally. No server account is connected.");
  }

  const isChinese = globalPrefs.chinese;

  return (
    <main className="app-root">
      <div className="phone-frame relative min-h-screen overflow-y-auto">
        <section className="px-5 pb-52 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="screen-kicker">
                {isChinese ? "個人" : "Personal"}
              </p>
              <h1 className="app-page-title mt-2">
                {isChinese ? "設定" : "Setup"}
              </h1>
            </div>

            <button
              type="button"
              onClick={() => {
                const loaded = loadPrefs();
                setPrefs(loaded);
                setDraft(loaded);
                setStatus("Settings reloaded.");
              }}
              className="theme-icon-button"
              title="Reload settings"
            >
              <RefreshCw size={22} strokeWidth={3} />
            </button>
          </div>

          <div className="settings-card mt-7">
            <div className="identity-row">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="avatar-button"
              >
                {prefs.avatar ? (
                  <img
                    src={prefs.avatar}
                    alt="Profile avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={34} color="white" />
                )}

                <span className="avatar-edit-badge">
                  <Camera size={12} strokeWidth={3} />
                </span>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadAvatar}
              />

              <div className="min-w-0 flex-1">
                <p className="profile-kicker">
                  Profile Identity
                </p>
                <p className="profile-name">
                  {prefs.name}
                </p>
                <p className="profile-sub profile-email">
                  {prefs.email}
                </p>
              </div>
            </div>

            <div className="settings-form-stack">
              <div>
                <p className="field-label">
                  Username
                </p>
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  className="theme-input"
                  placeholder="Your username"
                />
              </div>

              <div>
                <p className="field-label">
                  Gmail / Email
                </p>
                <input
                  value={draft.email}
                  onChange={(e) => updateDraft({ email: e.target.value })}
                  className="theme-input"
                  placeholder="your.email@gmail.com"
                />
              </div>

              <button
                type="button"
                onClick={saveProfileIdentity}
                className="app-primary-button w-full gap-2 px-4"
              >
                <Save size={16} strokeWidth={3} />
                Save Profile
              </button>
            </div>
          </div>

          <p className="settings-section-label">
            {isChinese ? "偏好設定" : "Preferences"}
          </p>

          <div className="space-y-3">
            <SettingRow
              icon={Moon}
              title={isChinese ? "外觀模式" : "Appearance"}
              subtitle={prefs.darkMode ? (isChinese ? "目前使用深色介面" : "Dark interface enabled") : (isChinese ? "目前使用淺色介面" : "Light interface enabled")}
              right={
                <ToggleSwitch
                  checked={prefs.darkMode}
                  onChange={(value) => updatePrefs({ darkMode: value })}
                />
              }
            />

            <SettingRow
              icon={Languages}
              title={isChinese ? "繁體中文介面" : "Chinese Interface"}
              subtitle={isChinese ? "切換為英文界面" : "Switch to Traditional Chinese"}
              right={
                <ToggleSwitch
                  checked={prefs.chinese}
                  onChange={(value) => updatePrefs({ chinese: value })}
                />
              }
            />
          </div>

          <p className="settings-section-label">
            {isChinese ? "感測器與數據" : "Sensors & Data"}
          </p>

          <div className="space-y-3">
            <SettingRow
              icon={Bell}
              title={isChinese ? "污染預警" : "Pollution Alerts"}
              subtitle={isChinese ? "當 CAQI 超過 50 時通知" : "Notify when CAQI > 50"}
              right={
                <ToggleSwitch
                  checked={prefs.notifications}
                  onChange={toggleNotifications}
                />
              }
            />
          </div>

          <p className="settings-section-label">
            {isChinese ? "個人健康配置" : "Health & Activity Profile"}
          </p>

          <SettingRow
            icon={ShieldCheck}
            title={isChinese ? "編輯健康配置" : "Edit Health Profile"}
            subtitle={isChinese ? "更新身體狀況與活動量" : "Update body condition and activity profile"}
            href="/profile"
            right={<ChevronRight size={22} className="summary-expand-icon" />}
          />

          {status && (
            <div className="status-callout">
              {status}
            </div>
          )}

          <button
            type="button"
            onClick={clearHistory}
            className="settings-button settings-button-danger mt-7"
          >
            <Trash2 size={19} strokeWidth={2.8} />
            {isChinese ? "清除歷史快取" : "Clear History Cache"}
          </button>

          <button
            type="button"
            onClick={logout}
            className="settings-button settings-button-violet mt-4"
          >
            <LogOut size={19} strokeWidth={2.8} />
            {isChinese ? "登出" : "Logout Session"}
          </button>

          <button
            type="button"
            onClick={sendTestAlert}
            className="settings-button settings-button-primary mt-4"
          >
            <Bell size={19} strokeWidth={2.8} />
            {isChinese ? "發送測試提醒" : "Send Test Alert"}
          </button>

          <div className="setup-footer">
            <p className="setup-footer-main">
              BLUE SKY TELEMETRY v2.4.0
            </p>
            <p className="setup-footer-sub">
              Designed for moenv.gov.tw • Taiwan
            </p>
          </div>
        </section>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
