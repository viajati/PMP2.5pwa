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

function ageStory(level, chinese) {
  if (level === 1) return chinese ? "年輕的萌芽，開始認識自己的空氣節奏。" : "A young seedling, starting your journey.";
  if (level === 2) return chinese ? "正值盛放階段，帶著能量探索日常。" : "In the bloom of life, exploring with energy.";
  if (level === 3) return chinese ? "穩定前行，帶著清楚的生活步調。" : "A steady guardian, moving with purpose.";
  if (level === 4) return chinese ? "成熟而敏銳，更值得細緻守護。" : "A wise soul, observing with deep grace.";
  return chinese ? "選擇年齡階段後，這裡會即時更新。" : "Choose your era and this story updates live.";
}

function vitalityStory(selected, chinese) {
  if (!selected?.length) return chinese ? "目前沒有特殊敏感因子，保持平穩呼吸。" : "Living with pure vitality and peace.";

  const stories = selected
    .map((id) => conditionOptions.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => chinese ? item.zhStory : item.story);

  if (stories.length === 1) {
    return chinese ? `正在${stories[0]}，用更溫柔的方式照顧自己。` : `You are ${stories[0]} with gentle care.`;
  }

  if (stories.length === 2) {
    return chinese ? `一邊${stories[0]}，一邊${stories[1]}。` : `A soul ${stories[0]} while ${stories[1]}.`;
  }

  const preview = stories.slice(0, 3).join(chinese ? "、" : ", ");
  return chinese ? `正在${preview}，並持續照顧其他敏感因子。` : `Guardian of your path, ${preview}, and more.`;
}

function activityStory(level, chinese) {
  if (level >= 3) return chinese ? "活動力旺盛，像風一樣穿梭在城市裡。" : "Your spirit is vibrant, dancing with nature's wind.";
  if (level >= 2) return chinese ? "用平衡的步調穿過日常路線。" : "You move with a balanced rhythm through the world.";
  return chinese ? "在安靜時刻裡保留自己的節奏。" : "You find stillness and peace in the quiet moments.";
}

function fitnessStory(level, chinese) {
  if (level >= 3) return chinese ? "身體韌性強，適合更有強度的活動安排。" : "You possess a soul that is unbreakable and firm.";
  if (level >= 2) return chinese ? "韌性正在穩定累積。" : "Your resilience is growing steady and strong.";
  return chinese ? "正在建立溫柔而穩固的基礎。" : "You are nurturing a gentle foundation of strength.";
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
            <div className="profile-native-header-top">
              <Link
                href="/setup"
                className="profile-native-back"
                title={t("Back to Setup", "返回設定")}
              >
                <ArrowLeft size={20} strokeWidth={3} />
              </Link>

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
                  title={t("Era", "年齡")}
                  text={ageStory(profile.ageLevel, isChinese)}
                  delay={40}
                />

                <StoryCard
                  icon={Heart}
                  title={t("Vitality", "敏感度")}
                  text={vitalityStory(profile.conditions, isChinese)}
                  delay={120}
                />
              </div>

              <div className="profile-native-boxes-row">
                <StoryCard
                  icon={Activity}
                  title={t("Lifestyle", "生活型態")}
                  text={activityStory(profile.activityLevel, isChinese)}
                  delay={200}
                />

                <StoryCard
                  icon={ShieldCheck}
                  title={t("Strength", "體能")}
                  text={fitnessStory(profile.fitnessLevel, isChinese)}
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

            <SectionTitle>{t("Life Era", "年齡階段")}</SectionTitle>

            <SliderBlock
              title={t("Age Group", "年齡族群")}
              value={profile.ageLevel}
              min={1}
              max={4}
              labels={ageLabels}
              onChange={(value) => updateProfile({ ageLevel: value })}
            />

            <SectionTitle>{t("Health Conditions", "健康狀況")}</SectionTitle>

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

            <SectionTitle>{t("Movement Flow", "活動量")}</SectionTitle>

            <SliderBlock
              title={t("Activity Level", "活動程度")}
              value={profile.activityLevel}
              min={1}
              max={3}
              labels={isChinese ? ["低", "中", "高"] : ["Quiet", "Flow", "Vibrant"]}
              onChange={(value) => updateProfile({ activityLevel: value })}
            />

            <SectionTitle>{t("Body Strength", "體能強度")}</SectionTitle>

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
