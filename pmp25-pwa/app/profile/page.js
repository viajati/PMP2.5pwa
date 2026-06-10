"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Camera,
  CalendarDays,
  Flower,
  Heart,
  Leaf,
  Save,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { useAuth } from "@/components/AuthProvider";
import AvatarPicker, { AvatarVisual } from "@/components/AvatarPicker";
import {
  saveHealthProfile,
  subscribeHealthProfile,
} from "@/lib/firebaseData";
import {
  DEFAULT_HEALTH_PROFILE,
  HEALTH_PROFILE_KEY,
  cleanHealthProfile,
} from "@/lib/healthProfile";

const SETUP_KEY = "pmp25_setup_preferences";

const defaultPrefs = {
  name: "",
  avatar: "",
};

const defaultProfile = DEFAULT_HEALTH_PROFILE;

const ageLabels = ["<18", "18–35", "36–60", "60+"];

const conditionOptions = [
  { id: "asthma", label: "Asthma", zh: "氣喘", icon: Sparkles, story: "tending to your breath", zhStory: "照顧呼吸" },
  { id: "dust", label: "Dust Allergies", zh: "塵蟎過敏", icon: Snowflake, story: "clearing the air", zhStory: "避開粉塵" },
  { id: "sensitivity", label: "Air Sensitivity", zh: "空氣敏感", icon: Leaf, story: "sensing the whispers", zhStory: "感受空氣變化" },
  { id: "allergies", label: "Pollen Allergies", zh: "花粉過敏", icon: Flower, story: "protecting your peace", zhStory: "守護日常舒適" },
  { id: "cardio", label: "Heart Vitality", zh: "心血管照護", icon: Heart, story: "nurturing your rhythm", zhStory: "照護身體節奏" },
  { id: "outdoor", label: "Outdoor Worker", zh: "戶外工作者", icon: Wrench, story: "braving the sky", zhStory: "長時間面對戶外空氣" },
];

function loadJson(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function profileIntroText(type, chinese) {
  const copy = {
    age: {
      en: "Your age group helps assess air pollution risk.",
      zh: "你的年齡族群有助於評估空氣污染風險。",
    },
    vitality: {
      en: "Current wellness status based on air quality exposure.",
      zh: "根據空氣品質暴露評估目前健康狀態。",
    },
    lifestyle: {
      en: "Daily habits that influence PM2.5 exposure levels.",
      zh: "日常習慣會影響 PM2.5 暴露程度。",
    },
    strength: {
      en: "Your ability to cope with environmental pollutants.",
      zh: "你面對環境污染物時的身體承受能力。",
    },
  };

  return chinese ? copy[type]?.zh : copy[type]?.en;
}

function StoryCard({ icon: Icon, title, text, delay = 0 }) {
  return (
    <div
      className="profile-native-status-box"
      style={{ "--story-delay": `${delay}ms` }}
    >
      <div className="profile-native-box-gradient">
        <Icon size={21} strokeWidth={2.8} />

        <p className="profile-native-box-title">
          {title}
        </p>

        <p className="profile-native-box-copy">
          {text}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="settings-section-label">
      {children}
    </p>
  );
}

function SliderBlock({
  title,
  value,
  min,
  max,
  labels,
  colorClass = "",
  onChange,
}) {
  const numericValue = Number(value);
  const safeValue = Math.min(max, Math.max(min, Number.isFinite(numericValue) ? numericValue : min));
  const progress = max === min ? 0 : ((safeValue - min) / (max - min)) * 100;
  const rangeStyle = { "--range-progress": `${progress}%` };
  const activeLabel = labels[safeValue - min] || labels[0] || "";

  return (
    <div
      className="slider-card profile-slider-card"
      style={rangeStyle}
    >
      <div className="slider-head">
        <p className="slider-title">
          {title}
        </p>

        <span className="slider-chip">
          {activeLabel}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={safeValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className={["theme-range", colorClass].join(" ")}
        style={rangeStyle}
      />

      <div className="slider-label-row">
        {labels.map((label) => (
          <span
            key={label}
            className="slider-label"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { prefs: appPrefs, updatePrefs, t } = useAppPreferences();
  const { user, account, firebaseReady } = useAuth();
  const isChinese = appPrefs.chinese;
  const authDisplayName = cleanText(account?.displayName) || cleanText(user?.displayName);
  const authEmail = account?.email || user?.email || "";
  const authPhotoURL = account?.photoURL || user?.photoURL || "";
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [profile, setProfile] = useState(defaultProfile);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      setPrefs(loadJson(SETUP_KEY, defaultPrefs));
      setProfile(cleanHealthProfile(loadJson(HEALTH_PROFILE_KEY, defaultProfile)));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      setPrefs({
        name: authDisplayName || cleanText(appPrefs.name),
        avatar: appPrefs.avatar || authPhotoURL,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    appPrefs.avatar,
    appPrefs.name,
    authDisplayName,
    authPhotoURL,
  ]);

  useEffect(() => {
    if (!firebaseReady || !user?.uid) return undefined;

    return subscribeHealthProfile(
      user.uid,
      (cloudProfile) => {
        if (!cloudProfile) {
          const localProfile = cleanHealthProfile(loadJson(HEALTH_PROFILE_KEY, defaultProfile));
          saveHealthProfile(user.uid, localProfile).catch((error) => {
            console.warn("Unable to seed cloud health profile:", error);
          });
          return;
        }

        setProfile(cleanHealthProfile(cloudProfile));
      },
      (error) => {
        console.warn("Unable to subscribe to cloud health profile:", error);
      }
    );
  }, [firebaseReady, user?.uid]);

  function updateProfile(patch) {
    setSaved(false);
    setProfile((current) => ({ ...current, ...patch }));
  }

  function toggleCondition(id) {
    const current = profile.conditions || [];
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];

    updateProfile({ conditions: next });
  }

  function chooseAvatar(avatar) {
    const nextPrefs = { ...prefs, avatar };
    setPrefs(nextPrefs);
    saveJson(SETUP_KEY, nextPrefs);
    updatePrefs({ avatar });
    setSaveError("");
    setSaved(false);
  }

  async function saveProfile() {
    saveJson(HEALTH_PROFILE_KEY, profile);

    try {
      if (firebaseReady && user?.uid) {
        await saveHealthProfile(user.uid, profile);
      }

      setSaveError("");
      setSaved(true);
    } catch (error) {
      setSaveError(error.message);
    }
  }

  const profileName = useMemo(() => (
    authDisplayName
    || cleanText(appPrefs.name)
    || cleanText(prefs.name)
    || cleanText(authEmail.split("@")[0])
  ), [appPrefs.name, authDisplayName, authEmail, prefs.name]);
  const profileSubtitle = authEmail || t("Health profile", "健康配置");

  return (
    <main className="app-root">
      <div className="phone-frame relative min-h-screen overflow-y-auto profile-native-frame">
        <section className="profile-native-header-layer">
          <div className="profile-native-gradient">
            {Array.from({ length: 10 }).map((_, index) => (
              <Leaf
                key={index}
                className="profile-floating-leaf"
                size={22}
                strokeWidth={2.5}
                style={{
                  "--leaf-x": `${(index * 43 + 13) % 100}%`,
                  "--leaf-delay": `${index * -1600}ms`,
                }}
              />
            ))}
          </div>

          <div className="profile-native-fixed-header">
            <div className="profile-native-page-header">
              <div>
                <p className="screen-kicker">{t("Identity", "身份")}</p>
                <h1 className="app-page-title">{t("Profile", "個人檔案")}</h1>
              </div>

              <Link
                href="/setup"
                className="profile-native-back"
                title={t("Back to Setup", "返回設定")}
              >
                <ArrowLeft size={20} strokeWidth={3} />
              </Link>
            </div>

            <div className="profile-native-header-top">
              <button
                type="button"
                className="profile-native-avatar-wrapper"
                onClick={() => document.getElementById("profile-avatar-picker")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                title={t("Change avatar", "更換頭像")}
              >
                <AvatarVisual value={prefs.avatar} className="profile-native-avatar" />
                <span className="profile-native-camera-badge">
                  <Camera size={12} strokeWidth={3} />
                </span>
              </button>

              <div className="profile-native-header-copy">
                <p className="profile-native-greeting">
                  {profileName
                    ? (isChinese ? `嗨，${profileName}!` : `Hi, ${profileName}!`)
                    : t("Personalize your profile", "個人化你的檔案")}
                </p>
                <h1 className="profile-native-title">{t("Personalize", "個人化")}</h1>
                <p className="profile-native-subtitle">
                  {profileSubtitle}
                </p>
              </div>
            </div>

            <div className="profile-native-boxes-container">
              <div className="profile-native-boxes-row">
                <StoryCard
                  icon={CalendarDays}
                  title={t("Age", "年齡")}
                  text={profileIntroText("age", isChinese)}
                  delay={40}
                />

                <StoryCard
                  icon={Heart}
                  title={t("Vitality", "健康狀態")}
                  text={profileIntroText("vitality", isChinese)}
                  delay={120}
                />
              </div>

              <div className="profile-native-boxes-row">
                <StoryCard
                  icon={Activity}
                  title={t("Lifestyle", "生活型態")}
                  text={profileIntroText("lifestyle", isChinese)}
                  delay={200}
                />

                <StoryCard
                  icon={ShieldCheck}
                  title={t("Strength", "體能")}
                  text={profileIntroText("strength", isChinese)}
                  delay={280}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="profile-native-scroll">
          <div className="profile-native-form-card">
            <div id="profile-avatar-picker">
              <AvatarPicker
                value={prefs.avatar}
                onChange={chooseAvatar}
                chinese={isChinese}
              />
            </div>

            <SectionTitle>{t("Age", "年齡")}</SectionTitle>

            <SliderBlock
              title={t("Age Group", "年齡族群")}
              value={profile.ageLevel}
              min={1}
              max={4}
              labels={ageLabels}
              onChange={(value) => updateProfile({ ageLevel: value })}
            />

            <SectionTitle>{t("Vitality", "健康狀態")}</SectionTitle>

            <div className="condition-panel">
              <div className="condition-list">
                {conditionOptions.map((item) => {
                  const Icon = item.icon;
                  const active = profile.conditions.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCondition(item.id)}
                      aria-pressed={active}
                      className={[
                        "condition-chip",
                        active
                          ? "condition-chip-active"
                          : "",
                      ].join(" ")}
                    >
                      <Icon size={16} strokeWidth={2.8} />
                      {isChinese ? item.zh : item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <SectionTitle>{t("Lifestyle", "生活型態")}</SectionTitle>

            <SliderBlock
              title={t("Activity Level", "活動程度")}
              value={profile.activityLevel}
              min={1}
              max={3}
              labels={isChinese ? ["低", "中", "高"] : ["Quiet", "Flow", "Vibrant"]}
              onChange={(value) => updateProfile({ activityLevel: value })}
            />

            <SectionTitle>{t("Strength", "體能")}</SectionTitle>

            <SliderBlock
              title={t("Fitness Level", "體能等級")}
              value={profile.fitnessLevel}
              min={1}
              max={3}
              labels={isChinese ? ["柔和", "穩定", "強"] : ["Soft", "Steady", "Strong"]}
              colorClass="theme-range-rose"
              onChange={(value) => updateProfile({ fitnessLevel: value })}
            />

            <button
              type="button"
              onClick={saveProfile}
              className="profile-native-save"
            >
              {t("Update Profile", "更新個人檔案")}
              <Save size={22} strokeWidth={2.8} />
            </button>

            {saved && (
              <div className="status-callout text-center">
                {firebaseReady && user
                  ? t("Profile updated and synced.", "個人檔案已更新並同步。")
                  : t("Profile updated locally.", "個人檔案已在本機更新。")}
              </div>
            )}

            {saveError && (
              <div className="status-callout text-center">
                {saveError}
              </div>
            )}

            <Link
              href="/setup"
              className="profile-back-link"
            >
              {t("Back to Setup", "返回設定")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
