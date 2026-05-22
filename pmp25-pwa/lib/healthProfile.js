export const HEALTH_PROFILE_KEY = "pmp25_health_profile";

export const DEFAULT_HEALTH_PROFILE = {
  ageLevel: 2,
  conditions: ["dust", "sensitivity"],
  activityLevel: 2,
  fitnessLevel: 2,
};

export function cleanHealthProfile(value = {}) {
  return {
    ageLevel: Number(value.ageLevel) || DEFAULT_HEALTH_PROFILE.ageLevel,
    conditions: Array.isArray(value.conditions)
      ? value.conditions
      : DEFAULT_HEALTH_PROFILE.conditions,
    activityLevel: Number(value.activityLevel) || DEFAULT_HEALTH_PROFILE.activityLevel,
    fitnessLevel: Number(value.fitnessLevel) || DEFAULT_HEALTH_PROFILE.fitnessLevel,
  };
}

export function loadLocalHealthProfile() {
  if (typeof window === "undefined") return DEFAULT_HEALTH_PROFILE;

  try {
    const raw = localStorage.getItem(HEALTH_PROFILE_KEY);
    return raw
      ? cleanHealthProfile(JSON.parse(raw))
      : DEFAULT_HEALTH_PROFILE;
  } catch {
    return DEFAULT_HEALTH_PROFILE;
  }
}
