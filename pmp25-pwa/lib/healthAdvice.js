const SENSITIVE_CONDITIONS = ["asthma", "cardio", "sensitivity", "dust", "allergies"];
const CONDITION_LABELS = {
  asthma: "asthma",
  cardio: "heart sensitivity",
  sensitivity: "air sensitivity",
  dust: "dust allergy",
  allergies: "pollen allergy",
  outdoor: "outdoor work",
};
const CONDITION_LABELS_ZH = {
  asthma: "氣喘",
  cardio: "心血管照護",
  sensitivity: "空氣敏感",
  dust: "塵蟎過敏",
  allergies: "花粉過敏",
  outdoor: "戶外工作",
};

function hasAny(profile, ids) {
  return ids.some((id) => profile.conditions?.includes(id));
}

function profileFocus(profile, chinese = false) {
  const labels = (profile.conditions || [])
    .map((id) => chinese ? CONDITION_LABELS_ZH[id] : CONDITION_LABELS[id])
    .filter(Boolean)
    .slice(0, 3);

  if (labels.length > 0) return labels.join(chinese ? "、" : ", ");
  return chinese ? "你的活動與體能設定" : "your activity and fitness profile";
}

function riskScore(pm25, weatherType, profile) {
  let score = 0;

  if (pm25 > 54.4) score += 4;
  else if (pm25 > 35.4) score += 3;
  else if (pm25 > 15.4) score += 1;

  if (hasAny(profile, ["asthma", "cardio"])) score += 2;
  if (hasAny(profile, ["sensitivity", "dust", "allergies"])) score += 1;
  if (profile.conditions?.includes("outdoor")) score += 1;
  if (profile.ageLevel === 1 || profile.ageLevel >= 4) score += 1;
  if (profile.activityLevel >= 3) score += 1;
  if (weatherType === "windy" || weatherType === "storm") score += 1;

  return score;
}

function adviceLevel(score) {
  if (score >= 7) return "high";
  if (score >= 4) return "moderate";
  return "low";
}

function englishAdvice({ city, pm25, weatherLabel, weatherType, profile }) {
  const score = riskScore(pm25, weatherType, profile);
  const level = adviceLevel(score);
  const sensitive = hasAny(profile, SENSITIVE_CONDITIONS);
  const actions = [];

  if (level === "high") {
    actions.push("Keep outdoor time short and choose indoor routes when possible.");
    actions.push(sensitive ? "Use a well-fitted mask and avoid intense exertion." : "Avoid hard outdoor exercise until PM2.5 improves.");
  } else if (level === "moderate") {
    actions.push("Prefer lower-traffic streets and reduce route time if symptoms appear.");
    actions.push(profile.activityLevel >= 3 ? "Move workouts indoors or lower the pace today." : "Light outdoor activity is okay with awareness.");
  } else {
    actions.push("Normal activity is reasonable, but keep watching the live reading.");
    actions.push("If symptoms start, shorten outdoor time and switch indoors.");
  }

  if (profile.conditions?.includes("outdoor")) {
    actions.push("Plan indoor breaks during long outdoor work blocks.");
  }

  if (profile.fitnessLevel <= 1 || profile.ageLevel >= 4) {
    actions.push("Choose a gentler pace and add recovery time if you need to be outside.");
  }

  if (weatherType === "windy") {
    actions.push("Wind can raise dust exposure, so eye and mask protection may help.");
  }

  const focus = profileFocus(profile);

  return {
    level,
    label: level === "high" ? "Personal caution" : level === "moderate" ? "Watch closely" : "Good to go",
    title: `${city}: ${pm25} µg/m³ with ${weatherLabel}`,
    summary: sensitive
      ? `Because your profile includes ${focus}, this reading matters more than the city average alone.`
      : `This suggestion combines the live reading with ${focus}.`,
    actions,
  };
}

function chineseAdvice({ city, pm25, weatherLabel, weatherType, profile }) {
  const score = riskScore(pm25, weatherType, profile);
  const level = adviceLevel(score);
  const sensitive = hasAny(profile, SENSITIVE_CONDITIONS);
  const actions = [];

  if (level === "high") {
    actions.push("盡量縮短戶外時間，優先選擇室內或低車流路線。");
    actions.push(sensitive ? "建議配戴貼合口罩，避免高強度活動。" : "PM2.5 改善前，先避免劇烈戶外運動。");
  } else if (level === "moderate") {
    actions.push("優先走低車流街道，若有不適就縮短路線。");
    actions.push(profile.activityLevel >= 3 ? "今天可改成室內運動或降低強度。" : "輕度戶外活動可以，但請持續留意。");
  } else {
    actions.push("一般活動可接受，但仍建議留意即時數值。");
    actions.push("若開始不舒服，請縮短戶外時間並轉往室內。");
  }

  if (profile.conditions?.includes("outdoor")) {
    actions.push("長時間戶外工作時，安排室內休息時段。");
  }

  if (profile.fitnessLevel <= 1 || profile.ageLevel >= 4) {
    actions.push("若需要外出，建議降低步調並保留恢復時間。");
  }

  if (weatherType === "windy") {
    actions.push("有風時粉塵暴露可能增加，口罩與眼部防護會更有幫助。");
  }

  const focus = profileFocus(profile, true);

  return {
    level,
    label: level === "high" ? "個人警戒" : level === "moderate" ? "需要留意" : "可正常活動",
    title: `${city}：${pm25} µg/m³，${weatherLabel}`,
    summary: sensitive
      ? `因為你的設定包含${focus}，這個數值會比城市平均更需要留意。`
      : `此建議會結合即時空氣與${focus}。`,
    actions,
  };
}

export function buildHealthAdvice({ city, pm25, weatherLabel, weatherType, profile, chinese }) {
  const payload = {
    city,
    pm25: Number(pm25) || 0,
    weatherLabel,
    weatherType,
    profile,
  };

  return chinese ? chineseAdvice(payload) : englishAdvice(payload);
}
