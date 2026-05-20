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
  { id: "asthma", label: "Asthma", icon: Sparkles },
  { id: "dust", label: "Dust Allergies", icon: Snowflake },
  { id: "sensitivity", label: "Air Sensitivity", icon: Leaf },
  { id: "allergies", label: "Pollen Allergies", icon: Flower },
  { id: "cardio", label: "Heart Vitality", icon: Heart },
  { id: "outdoor", label: "Outdoor Worker", icon: Wrench },
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

function ageStory(level) {
  if (level === 1) return "Young and more vulnerable to poor air.";
  if (level === 2) return "Active adult with balanced exposure risk.";
  if (level === 3) return "Stable routine with moderate sensitivity.";
  return "Older adult with higher protection priority.";
}

function vitalityStory(selected) {
  if (!selected?.length) return "No special sensitivity selected.";

  if (selected.length === 1) {
    const found = conditionOptions.find((item) => item.id === selected[0]);
    return found ? `${found.label} selected.` : "Health sensitivity selected.";
  }

  return `${selected.length} sensitivity factors selected.`;
}

function activityStory(level) {
  if (level === 1) return "Low outdoor movement.";
  if (level === 2) return "Moderate daily movement.";
  return "High outdoor activity and ventilation.";
}

function fitnessStory(level) {
  if (level === 1) return "Soft baseline.";
  if (level === 2) return "Steady fitness.";
  return "Strong fitness and higher exertion.";
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
        <section className="px-5 pb-40 pt-8">
          <div className="flex items-center justify-between">
            <Link
              href="/setup"
              className="theme-icon-button"
            >
              <ArrowLeft size={22} strokeWidth={3} />
            </Link>

            <div className="text-right">
              <p className="screen-kicker">Profile</p>
              <h1 className="app-page-title mt-2">Health</h1>
            </div>
          </div>

          <div className="profile-card mt-7">
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
                  Personalize
                </p>
                <p className="profile-name">
                  Hi, {prefs.name || "User"}
                </p>
                <p className="profile-sub">
                  Health and activity profile
                </p>
              </div>
            </div>
          </div>

          <div className="story-grid">
            <StoryCard
              icon={CalendarDays}
              title="Era"
              text={ageStory(profile.ageLevel)}
            />

            <StoryCard
              icon={Heart}
              title="Vitality"
              text={vitalityStory(profile.conditions)}
            />

            <StoryCard
              icon={Activity}
              title="Lifestyle"
              text={activityStory(profile.activityLevel)}
            />

            <StoryCard
              icon={ShieldCheck}
              title="Strength"
              text={fitnessStory(profile.fitnessLevel)}
            />
          </div>

          <SectionTitle>Life Era</SectionTitle>

          <SliderBlock
            title="Age Group"
            value={profile.ageLevel}
            min={1}
            max={4}
            labels={ageLabels}
            onChange={(value) => updateProfile({ ageLevel: value })}
          />

          <SectionTitle>Health Conditions</SectionTitle>

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
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <SectionTitle>Movement Flow</SectionTitle>

          <SliderBlock
            title="Activity Level"
            value={profile.activityLevel}
            min={1}
            max={3}
            labels={["Quiet", "Flow", "Vibrant"]}
            onChange={(value) => updateProfile({ activityLevel: value })}
          />

          <SectionTitle>Soul Strength</SectionTitle>

          <SliderBlock
            title="Fitness Level"
            value={profile.fitnessLevel}
            min={1}
            max={3}
            labels={["Soft", "Steady", "Strong"]}
            colorClass="theme-range-rose"
            onChange={(value) => updateProfile({ fitnessLevel: value })}
          />

          <button
            type="button"
            onClick={saveProfile}
            className="settings-button settings-button-primary mt-8"
          >
            <Save size={19} strokeWidth={2.8} />
            Update Profile
          </button>

          {saved && (
            <div className="status-callout text-center">
              Profile updated.
            </div>
          )}

          <Link
            href="/setup"
            className="profile-back-link"
          >
            Back to Setup
          </Link>
        </section>
      </div>
    </main>
  );
}
