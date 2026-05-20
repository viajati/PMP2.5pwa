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
        "relative h-[32px] w-[56px] shrink-0 rounded-full transition",
        checked ? "bg-[#00D2FF]" : "bg-white/12",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[4px] h-[24px] w-[24px] rounded-full bg-white transition",
          checked ? "left-[28px]" : "left-[4px]",
        ].join(" ")}
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
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#00D2FF]/10 text-[#00D2FF]">
        <Icon size={22} strokeWidth={2.7} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-black leading-tight text-white">
          {title}
        </p>
        <p className="mt-1 text-[11px] font-bold leading-snug text-white/42">
          {subtitle}
        </p>
      </div>

      {right}
    </>
  );

  const className =
    "flex min-h-[76px] w-full items-center gap-3 rounded-[26px] bg-[#1d1d20] px-4 py-4 text-left shadow-[0_14px_34px_rgba(0,0,0,0.24)]";

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
    const loaded = loadPrefs();
    setPrefs(loaded);
    setDraft(loaded);
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
      <div className="phone-frame relative min-h-screen overflow-y-auto bg-[#05070d] text-white">
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
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#00D2FF]"
              title="Reload settings"
            >
              <RefreshCw size={22} strokeWidth={3} />
            </button>
          </div>

          <div className="mt-7 rounded-[30px] bg-[#1d1d20] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex h-[82px] w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-[#6A11CB] to-[#2575FC] shadow-[0_0_28px_rgba(0,210,255,0.30)]"
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

                <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white bg-[#00D2FF]">
                  <Camera size={12} color="white" strokeWidth={3} />
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
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                  Profile Identity
                </p>
                <p className="mt-2 truncate text-[20px] font-black leading-tight text-white">
                  {prefs.name}
                </p>
                <p className="mt-1 truncate text-[11px] font-black text-[#00D2FF]">
                  {prefs.email}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/38">
                  Username
                </p>
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  className="w-full rounded-[18px] border border-white/8 bg-white/8 px-4 py-3 text-[14px] font-bold text-white outline-none placeholder:text-white/25"
                  placeholder="Your username"
                />
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/38">
                  Gmail / Email
                </p>
                <input
                  value={draft.email}
                  onChange={(e) => updateDraft({ email: e.target.value })}
                  className="w-full rounded-[18px] border border-white/8 bg-white/8 px-4 py-3 text-[14px] font-bold text-white outline-none placeholder:text-white/25"
                  placeholder="your.email@gmail.com"
                />
              </div>

              <button
                type="button"
                onClick={saveProfileIdentity}
                className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#00D2FF] px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-white"
              >
                <Save size={16} strokeWidth={3} />
                Save Profile
              </button>
            </div>
          </div>

          <p className="mt-7 mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#00D2FF]/70">
            {isChinese ? "偏好設定" : "Preferences"}
          </p>

          <div className="space-y-3">
            <SettingRow
              icon={Moon}
              title={isChinese ? "深色主題" : "Dark Mode"}
              subtitle={isChinese ? "夜間高對比度視圖" : "High contrast night view"}
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

          <p className="mt-7 mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#00D2FF]/70">
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

          <p className="mt-7 mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#00D2FF]/70">
            {isChinese ? "個人健康配置" : "Health & Activity Profile"}
          </p>

          <SettingRow
            icon={ShieldCheck}
            title={isChinese ? "編輯健康配置" : "Edit Health Profile"}
            subtitle={isChinese ? "更新身體狀況與活動量" : "Update body condition and activity profile"}
            href="/profile"
            right={<ChevronRight size={22} className="text-white/35" />}
          />

          {status && (
            <div className="mt-5 rounded-[22px] border border-[#00D2FF]/25 bg-[#00D2FF]/10 px-4 py-3 text-[13px] font-bold leading-relaxed text-white/72">
              {status}
            </div>
          )}

          <button
            type="button"
            onClick={clearHistory}
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-[24px] border border-[#FF3B30]/25 bg-[#FF3B30]/10 px-4 py-4 text-[13px] font-black text-[#FF3B30]"
          >
            <Trash2 size={19} strokeWidth={2.8} />
            {isChinese ? "清除歷史快取" : "Clear History Cache"}
          </button>

          <button
            type="button"
            onClick={logout}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-[24px] bg-gradient-to-r from-[#6A11CB] to-[#7B0EE8] px-4 py-5 text-[13px] font-black uppercase tracking-[0.14em] text-white shadow-[0_16px_36px_rgba(106,17,203,0.24)]"
          >
            <LogOut size={19} strokeWidth={2.8} />
            {isChinese ? "登出" : "Logout Session"}
          </button>

          <button
            type="button"
            onClick={sendTestAlert}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-[24px] bg-[#00D2FF] px-4 py-5 text-[13px] font-black uppercase tracking-[0.14em] text-white shadow-[0_16px_36px_rgba(0,210,255,0.22)]"
          >
            <Bell size={19} strokeWidth={2.8} />
            {isChinese ? "發送測試提醒" : "Send Test Alert"}
          </button>

          <div className="mb-10 mt-9 text-center">
            <p className="text-[10px] font-black tracking-[0.16em] text-white/35">
              BLUE SKY TELEMETRY v2.4.0
            </p>
            <p className="mt-1 text-[9px] font-extrabold text-white/24">
              Designed for moenv.gov.tw • Taiwan
            </p>
          </div>
        </section>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
