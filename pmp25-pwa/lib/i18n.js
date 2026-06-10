export const CITY_ZH = {
  Taiwan: "台灣",
  "Taipei City": "臺北市",
  "New Taipei City": "新北市",
  "Taoyuan City": "桃園市",
  "Taichung City": "臺中市",
  "Tainan City": "臺南市",
  "Kaohsiung City": "高雄市",
  "Keelung City": "基隆市",
  "Hsinchu City": "新竹市",
  "Chiayi City": "嘉義市",
  "Hsinchu County": "新竹縣",
  "Miaoli County": "苗栗縣",
  "Changhua County": "彰化縣",
  "Nantou County": "南投縣",
  "Yunlin County": "雲林縣",
  "Chiayi County": "嘉義縣",
  "Pingtung County": "屏東縣",
  "Yilan County": "宜蘭縣",
  "Hualien County": "花蓮縣",
  "Taitung County": "臺東縣",
  "Penghu County": "澎湖縣",
  "Kinmen County": "金門縣",
  "Lienchiang County": "連江縣",
};

export const REGION_ZH = {
  ALL: "全部",
  NORTH: "北部",
  WEST: "西部",
  SOUTH: "南部",
  EAST: "東部",
};

export const WEATHER_ZH = {
  sunny: "晴朗",
  "mostly sunny": "多雲時晴",
  partly: "晴時多雲",
  "partly cloudy": "晴時多雲",
  cloudy: "陰天",
  foggy: "有霧",
  rainy: "下雨",
  raining: "下雨",
  windy: "有風",
  stormy: "雷雨",
  storm: "雷雨",
};

export const RISK_ZH = {
  GOOD: "良好",
  LOW: "低",
  MODERATE: "普通",
  POOR: "偏差",
  HIGH: "高",
  "VERY HIGH": "非常高",
};

export const TRANSPORT_ZH = {
  car: "開車",
  bike: "騎車",
  walk: "步行",
};

export const WEEKDAY_ZH = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export function cityName(city, chinese = false) {
  if (!chinese) return city;
  return CITY_ZH[city] || city;
}

export function regionName(region, chinese = false) {
  if (!chinese) return region;
  return REGION_ZH[region] || region;
}

export function weatherName(labelOrType, chinese = false) {
  if (!chinese) return labelOrType;
  return WEATHER_ZH[labelOrType] || labelOrType;
}

export function riskName(label, chinese = false) {
  if (!chinese) return label;
  return RISK_ZH[label] || label;
}

export function transportName(mode, chinese = false) {
  if (!chinese) {
    if (mode === "walk") return "Walk";
    if (mode === "bike") return "Bike";
    return "Car";
  }

  return TRANSPORT_ZH[mode] || mode;
}

export function routeSourceName(source, chinese = false) {
  if (source === "OSRM") return chinese ? "道路路線" : "road route";
  if (source === "GPS samples") return chinese ? "手機 GPS" : "phone GPS";
  if (source === "GPS estimate") return chinese ? "GPS 估算" : "GPS estimate";
  if (source === "Time samples") return chinese ? "10 分鐘 PM2.5" : "10-min PM2.5 samples";
  if (source === "Simulation") return chinese ? "模擬路線" : "simulation route";
  if (source === "routing road path") return chinese ? "正在規劃道路路線" : "routing road path";

  return source || (chinese ? "手機 GPS" : "phone GPS");
}

export function citySearchText(city) {
  return `${city} ${CITY_ZH[city] || ""}`.toLowerCase();
}

function dateFromSummaryId(id) {
  const [year, month, day] = String(id || "").split("_").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function summaryDayName(day, chinese = false) {
  if (!chinese) return day.dayName;
  if (day.dayName === "TODAY") return "今天";

  const date = dateFromSummaryId(day.id);
  return date ? WEEKDAY_ZH[date.getDay()] : day.dayName;
}

export function summaryDate(day, chinese = false) {
  if (!chinese) return day.date;

  const date = dateFromSummaryId(day.id);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日` : day.date;
}

export function localDateString(date, chinese = false) {
  return date.toLocaleDateString(chinese ? "zh-TW" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
