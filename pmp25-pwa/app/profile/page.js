"use client";

import { useEffect, useState } from "react";
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
  { id: "asthma", label: "Asthma", zh: "氣喘", icon: Sparkles },
  { id: "dust", label: "Dust Allergies", zh: "塵蟎過敏", icon: Snowflake },
  { id: "sensitivity", label: "Air Sensitivity", zh: "空氣敏感", icon: Leaf },
  { id: "allergies", label: "Pollen Allergies", zh: "花粉過敏", icon: Flower },
  { id: "cardio", label: "Heart Vitality", zh: "心血管照護", icon: Heart },
  { id: "outdoor", label: "Outdoor Worker", zh: "戶外工作者", icon: Wrench },
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

function ageStory(level, chinese) {
  if (level === 1) return chinese ? "年紀較小，對空氣污染更敏感。" : "Young and more vulnerable to poor air.";
  if (level === 2) return chinese ? "活躍成人，暴露風險較平衡。" : "Active adult with balanced exposure risk.";
  if (level === 3) return chinese ? "生活穩定，具有中度敏感度。" : "Stable routine with moderate sensitivity.";
  return chinese ? "高齡族群，需要更高保護優先度。" : "Older adult with higher protection priority.";
}

function vitalityStory(selected, chinese) {
  if (!selected?.length) return chinese ? "尚未選擇特殊敏感因子。" : "No special sensitivity selected.";

  if (selected.length === 1) {
    const found = conditionOptions.find((item) => item.id === selected[0]);
    return found
      ? chinese
        ? `已選擇${found.zh}。`
        : `${found.label} selected.`
      : chinese
        ? "已選擇健康敏感因子。"
        : "Health sensitivity selected.";
  }

  return chinese ? `已選擇 ${selected.length} 個敏感因子。` : `${selected.length} sensitivity factors selected.`;
}

function activityStory(level, chinese) {
  if (level === 1) return chinese ? "戶外活動較低。" : "Low outdoor movement.";
  if (level === 2) return chinese ? "日常活動量中等。" : "Moderate daily movement.";
  return chinese ? "戶外活動與通風接觸較高。" : "High outdoor activity and ventilation.";
}

function fitnessStory(level, chinese) {
  if (level === 1) return chinese ? "身體基準較溫和。" : "Soft baseline.";
  if (level === 2) return chinese ? "體能狀態穩定。" : "Steady fitness.";
  return chinese ? "體能較強，活動強度較高。" : "Strong fitness and higher exertion.";
}

function StoryCard({ icon: Icon, title, text }) {
  return (
    <div className="profile-native-status-box">
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
  return (
    <div className="slider-card">
      <div className="slider-head">
        <p className="slider-title">
          {title}
        </p>

        <span className="slider-chip">
          {labels[value - min]}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={["theme-range", colorClass].join(" ")}
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
  const { user, firebaseReady } = useAuth();
  const isChinese = appPrefs.chinese;
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
        name: appPrefs.name || user?.displayName || "",
        avatar: appPrefs.avatar || user?.photoURL || "",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [appPrefs.avatar, appPrefs.name, user?.displayName, user?.photoURL]);

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
                  "--leaf-delay": `${index * 1000}ms`,
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

              <div className="profile-native-avatar-wrapper">
                <AvatarVisual value={prefs.avatar} className="profile-native-avatar" />
                <span className="profile-native-camera-badge">
                  <Camera size={12} strokeWidth={3} />
                </span>
              </div>

              <div className="min-w-0">
                <p className="profile-native-greeting">
                  {t("Hi", "嗨")}，{prefs.name || user?.email?.split("@")[0] || t("User", "使用者")}!
                </p>
                <h1 className="profile-native-title">{t("Personalize", "個人化")}</h1>
              </div>
            </div>

            <div className="profile-native-boxes-container">
              <div className="profile-native-boxes-row">
                <StoryCard
                  icon={CalendarDays}
                  title={t("Era", "年齡")}
                  text={ageStory(profile.ageLevel, isChinese)}
                />

                <StoryCard
                  icon={Heart}
                  title={t("Vitality", "敏感度")}
                  text={vitalityStory(profile.conditions, isChinese)}
                />
              </div>

              <div className="profile-native-boxes-row">
                <StoryCard
                  icon={Activity}
                  title={t("Lifestyle", "生活型態")}
                  text={activityStory(profile.activityLevel, isChinese)}
                />

                <StoryCard
                  icon={ShieldCheck}
                  title={t("Strength", "體能")}
                  text={fitnessStory(profile.fitnessLevel, isChinese)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="profile-native-scroll">
          <div className="profile-native-form-card">
          <AvatarPicker
            value={prefs.avatar}
            onChange={chooseAvatar}
            chinese={isChinese}
          />

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
