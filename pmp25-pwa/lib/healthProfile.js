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

export function notificationPm25Threshold(profile = DEFAULT_HEALTH_PROFILE) {
  const cleanProfile = cleanHealthProfile(profile);
  const conditions = new Set(cleanProfile.conditions);
  const sensitiveConditions = ["asthma", "dust", "sensitivity", "allergies", "cardio"];
  const hasSensitiveCondition = sensitiveConditions.some((id) => conditions.has(id));
  let threshold = 50;

  if (hasSensitiveCondition) threshold -= 8;
  if (cleanProfile.ageLevel === 1 || cleanProfile.ageLevel >= 4) threshold -= 5;
  if (cleanProfile.activityLevel >= 3 || conditions.has("outdoor")) threshold -= 4;
  if (cleanProfile.fitnessLevel <= 1) threshold -= 3;
  if (cleanProfile.fitnessLevel >= 3 && !hasSensitiveCondition) threshold += 3;

  return Math.max(35, Math.min(50, Math.round(threshold / 5) * 5));
}

export function shouldNotifyForPm25(pm25, profile = DEFAULT_HEALTH_PROFILE) {
  const value = Number(pm25);
  return Number.isFinite(value) && value >= notificationPm25Threshold(profile);
}
