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
    <div className="rounded-[24px] bg-white/8 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.20)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#00D2FF]/10 text-[#00D2FF]">
        <Icon size={21} strokeWidth={2.8} />
      </div>

      <p className="mt-3 text-[15px] font-black leading-tight text-white">
        {title}
      </p>

      <p className="mt-2 text-[11px] font-bold leading-snug text-white/45">
        {text}
      </p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="mb-3 mt-7 text-[11px] font-black uppercase tracking-[0.18em] text-[#00D2FF]/70">
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
  colorClass = "accent-[#00D2FF]",
  onChange,
}) {
  return (
    <div className="rounded-[26px] bg-[#1d1d20] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-black leading-tight text-white">
          {title}
        </p>

        <span className="rounded-full bg-[#00D2FF]/10 px-3 py-1 text-[11px] font-black text-[#00D2FF]">
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
        className={`mt-5 w-full ${colorClass}`}
      />

      <div className="mt-3 flex justify-between">
        {labels.map((label) => (
          <span
            key={label}
            className="text-[10px] font-black text-white/38"
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
      <div className="phone-frame relative min-h-screen overflow-y-auto bg-[#05070d] text-white">
        <section className="px-5 pb-40 pt-8">
          <div className="flex items-center justify-between">
            <Link
              href="/setup"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#00D2FF]"
            >
              <ArrowLeft size={22} strokeWidth={3} />
            </Link>

            <div className="text-right">
              <p className="screen-kicker">Profile</p>
              <h1 className="app-page-title mt-2">Health</h1>
            </div>
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
                  Personalize
                </p>
                <p className="mt-2 truncate text-[20px] font-black leading-tight text-white">
                  Hi, {prefs.name || "User"}
                </p>
                <p className="mt-1 text-[11px] font-bold text-white/42">
                  Health and activity profile
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
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

          <div className="rounded-[26px] bg-[#1d1d20] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
            <div className="flex flex-wrap gap-2.5">
              {conditionOptions.map((item) => {
                const Icon = item.icon;
                const active = profile.conditions.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleCondition(item.id)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-4 py-3 text-[12px] font-black transition",
                      active
                        ? "bg-[#00D2FF] text-white"
                        : "bg-white/8 text-white/55",
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
            colorClass="accent-[#FF6575]"
            onChange={(value) => updateProfile({ fitnessLevel: value })}
          />

          <button
            type="button"
            onClick={saveProfile}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-[24px] bg-[#00D2FF] px-4 py-5 text-[13px] font-black uppercase tracking-[0.14em] text-white shadow-[0_16px_36px_rgba(0,210,255,0.22)]"
          >
            <Save size={19} strokeWidth={2.8} />
            Update Profile
          </button>

          {saved && (
            <div className="mt-5 rounded-[22px] border border-[#00D2FF]/25 bg-[#00D2FF]/10 px-4 py-3 text-center text-[13px] font-bold leading-relaxed text-white/72">
              Profile updated.
            </div>
          )}

          <Link
            href="/setup"
            className="mt-5 block text-center text-[13px] font-black text-[#00D2FF]"
          >
            Back to Setup
          </Link>
        </section>
      </div>
    </main>
  );
}
