"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  Languages,
  LogOut,
  Moon,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import OriginalBottomNav from "@/components/OriginalBottomNav";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { useAuth } from "@/components/AuthProvider";
import AvatarPicker, { AvatarVisual } from "@/components/AvatarPicker";
import { clearUserRoutes } from "@/lib/firebaseData";

const STORAGE_KEY = "pmp25_setup_preferences";

const DEFAULT_PREFS = {
  name: "",
  email: "",
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
  const router = useRouter();
  const { prefs: globalPrefs, updatePrefs: updateGlobalPrefs, t } = useAppPreferences();
  const {
    user,
    firebaseReady,
    logout: logoutUser,
    updateAccountProfile,
  } = useAuth();
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

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const accountName = user?.displayName?.trim() || "";
      const identityPrefs = {
        ...globalPrefs,
        name: accountName || globalPrefs.name || "",
        email: user?.email || "",
      };

      setPrefs(identityPrefs);
      setDraft(identityPrefs);
    });

    return () => {
      cancelled = true;
    };
  }, [globalPrefs, user?.displayName, user?.email]);

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

  async function saveProfileIdentity() {
    const cleanName = draft.name.trim();

    try {
      if (!cleanName) {
        setStatus(t("Enter a username before saving.", "請先輸入使用者名稱。"));
        return;
      }

      updatePrefs({
        name: cleanName,
      });

      if (firebaseReady && user) {
        await updateAccountProfile({ displayName: cleanName });
      }

      setStatus(firebaseReady && user
        ? t("Profile identity saved and synced.", "個人識別已儲存並同步。")
        : t("Profile identity saved locally.", "個人識別已儲存在本機。"));
    } catch (error) {
      setStatus(error.message);
    }
  }

  function chooseAvatar(avatar) {
    updatePrefs({ avatar });
    setStatus(firebaseReady && user
      ? t("Profile picture saved and synced.", "個人頭像已儲存並同步。")
      : t("Profile picture saved locally.", "個人頭像已儲存在本機。"));
  }

  async function toggleNotifications(value) {
    if (value && typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        updatePrefs({ notifications: false });
        setStatus(t("Notification permission was not granted.", "未取得通知權限。"));
        return;
      }
    }

    updatePrefs({ notifications: value });
    setStatus(value ? t("Pollution alerts enabled.", "污染提醒已啟用。") : t("Pollution alerts disabled.", "污染提醒已關閉。"));
  }

  async function sendTestAlert() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus(t("Browser notifications are not supported.", "此瀏覽器不支援通知。"));
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      setStatus(t("Please allow notifications first.", "請先允許通知權限。"));
      return;
    }

    new Notification(t("Test Notification", "測試通知"), {
      body: t("If you see this, notifications are working!", "如果你看到這則訊息，代表通知功能正常。"),
    });

    setStatus(t("Test notification sent.", "測試通知已送出。"));
  }

  async function clearHistory() {
    const ok = window.confirm(t("Clear local route and history cache?", "清除本機路線與歷史快取？"));
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
    updateGlobalPrefs(DEFAULT_PREFS);

    if (firebaseReady && user?.uid) {
      try {
        await clearUserRoutes(user.uid);
      } catch (error) {
        console.warn("Unable to clear cloud routes:", error);
      }
    }

    setStatus(firebaseReady && user
      ? t("Local and cloud route history cleared.", "本機與雲端路線歷史已清除。")
      : t("History cache cleared.", "歷史快取已清除。"));
  }

  async function logout() {
    const ok = window.confirm(t("Logout this session?", "登出這個工作階段？"));
    if (!ok) return;

    if (firebaseReady && user) {
      await logoutUser();
      router.push("/login");
      return;
    }

    setStatus(t("No server account is connected.", "目前未連接伺服器帳號。"));
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
                setStatus(t("Settings reloaded.", "設定已重新載入。"));
              }}
              className="theme-icon-button"
              title={isChinese ? "重新載入設定" : "Reload settings"}
            >
              <RefreshCw size={22} strokeWidth={3} />
            </button>
          </div>

          <div className="settings-card mt-7">
            <div className="identity-row">
              <AvatarVisual value={prefs.avatar} className="avatar-button" />

              <div className="min-w-0 flex-1">
                <p className="profile-kicker">
                  {isChinese ? "個人識別" : "Profile Identity"}
                </p>
                <p className="profile-name">
                  {prefs.name || user?.displayName || (isChinese ? "使用者" : "User")}
                </p>
                <p className="profile-sub profile-email">
                  {user?.email || (isChinese ? "尚未登入" : "Not signed in")}
                </p>
              </div>
            </div>

            <AvatarPicker
              value={prefs.avatar}
              onChange={chooseAvatar}
              chinese={isChinese}
            />

            <div className="settings-form-stack">
              <div>
                <p className="field-label">
                  {isChinese ? "使用者名稱" : "Username"}
                </p>
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  className="theme-input"
                  placeholder={isChinese ? "你的使用者名稱" : "Your username"}
                />
              </div>

              <div>
                <p className="field-label">
                  {isChinese ? "帳號 Email" : "Account Email"}
                </p>
                <div className="theme-readonly-field">
                  {user?.email || (isChinese ? "尚未登入" : "Not signed in")}
                </div>
              </div>

              <button
                type="button"
                onClick={saveProfileIdentity}
                className="app-primary-button w-full gap-2 px-4"
              >
                <Save size={16} strokeWidth={3} />
                {isChinese ? "儲存個人檔案" : "Save Profile"}
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
              subtitle={isChinese ? "關閉後切換回英文介面" : "Switch to Traditional Chinese"}
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
              icon={ShieldCheck}
              title={firebaseReady ? (user ? (isChinese ? "雲端同步已連線" : "Cloud Sync Connected") : (isChinese ? "尚未登入" : "Not Signed In")) : (isChinese ? "Firebase 尚未設定" : "Firebase Not Configured")}
              subtitle={firebaseReady ? (user ? (isChinese ? "偏好、健康資料與路線會同步到 Firestore" : "Preferences, health profile, and routes sync to Firestore") : (isChinese ? "登入後即可同步資料" : "Sign in to sync your data")) : (isChinese ? "加入環境變數後啟用登入與 Firestore" : "Add env values to enable Auth and Firestore")}
              href={user ? "/verify" : "/login"}
              right={<ChevronRight size={22} className="summary-expand-icon" />}
            />

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
              {isChinese ? "為 moenv.gov.tw 與台灣空氣資料設計" : "Designed for moenv.gov.tw • Taiwan"}
            </p>
          </div>
        </section>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
