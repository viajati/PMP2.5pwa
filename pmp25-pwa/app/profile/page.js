"use client";

import { useEffect, useRef, useState } from "react";
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
  User,
  Wrench,
} from "lucide-react";
import { useAppPreferences } from "@/components/AppPreferencesProvider";

const SETUP_KEY = "pmp25_setup_preferences";
const PROFILE_KEY = "pmp25_health_profile";

const defaultPrefs = {
  name: "Angeline",
  avatar: "",
};

const defaultProfile = {
  ageLevel: 2,
  conditions: ["dust", "sensitivity"],
  activityLevel: 2,
  fitnessLevel: 2,
};

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
    <div className="story-card">
      <div className="story-card-icon">
        <Icon size={21} strokeWidth={2.8} />
      </div>

      <p className="story-card-title">
        {title}
      </p>

      <p className="story-card-copy">
        {text}
      </p>
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
  const { prefs: appPrefs, t } = useAppPreferences();
  const isChinese = appPrefs.chinese;
  const fileRef = useRef(null);
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [profile, setProfile] = useState(defaultProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      setPrefs(loadJson(SETUP_KEY, defaultPrefs));
      setProfile(loadJson(PROFILE_KEY, defaultProfile));
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const nextPrefs = { ...prefs, avatar: reader.result };
      setPrefs(nextPrefs);
      saveJson(SETUP_KEY, nextPrefs);
    };

    reader.readAsDataURL(file);
  }

  function saveProfile() {
    saveJson(PROFILE_KEY, profile);
    setSaved(true);
  }

  return (
    <main className="app-root">
      <div className="phone-frame relative min-h-screen overflow-y-auto">
        <section className="app-page-body profile-page-body">
          <div className="app-page-header">
            <Link
              href="/setup"
              className="theme-icon-button"
            >
              <ArrowLeft size={22} strokeWidth={3} />
            </Link>

            <div className="text-right">
              <p className="screen-kicker">{t("Profile", "個人檔案")}</p>
              <h1 className="app-page-title mt-2">{t("Health", "健康")}</h1>
            </div>
          </div>

          <div className="profile-card profile-identity-card">
            <div className="identity-row">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="avatar-button"
              >
                {prefs.avatar ? (
                  <img
                    src={prefs.avatar}
                    alt={t("Profile avatar", "個人頭像")}
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
                  {t("Personalize", "個人化")}
                </p>
                <p className="profile-name">
                  {t("Hi", "嗨")}，{prefs.name || t("User", "使用者")}
                </p>
                <p className="profile-sub">
                  {t("Health and activity profile", "健康與活動設定")}
                </p>
              </div>
            </div>
          </div>

          <div className="story-grid">
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
            className="settings-button settings-button-primary mt-8"
          >
            <Save size={19} strokeWidth={2.8} />
            {t("Update Profile", "更新個人檔案")}
          </button>

          {saved && (
            <div className="status-callout text-center">
              {t("Profile updated.", "個人檔案已更新。")}
            </div>
          )}

          <Link
            href="/setup"
            className="profile-back-link"
          >
            {t("Back to Setup", "返回設定")}
          </Link>
        </section>
      </div>
    </main>
  );
}
