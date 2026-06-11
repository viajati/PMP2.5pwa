"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Footprints,
  Gauge,
  RefreshCw,
} from "lucide-react";
import OriginalBottomNav from "@/components/OriginalBottomNav";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { useAuth } from "@/components/AuthProvider";
import {
  SUMMARY_PERIODS,
  buildAllSummaries,
  buildWeeklySummary,
  exposureRisk,
} from "@/lib/summaryStats";
import { loadUserRouteHistory } from "@/lib/firebaseData";
import { routeDateId } from "@/lib/trackStorage";
import {
  cityName,
  routeSourceName,
  summaryDate,
  summaryDayName,
  transportName,
} from "@/lib/i18n";

const PERIOD_LABELS_ZH = {
  weekly: "每週",
  monthly: "每月",
  yearly: "每年",
};

const HISTORY_LOG_LABELS_EN = {
  weekly: "WEEKLY HISTORY LOG",
  monthly: "MONTHLY HISTORY LOG",
  yearly: "YEARLY HISTORY LOG",
};

const HISTORY_LOG_LABELS_ZH = {
  weekly: "每週歷史紀錄",
  monthly: "每月歷史紀錄",
  yearly: "每年歷史紀錄",
};

function safeRisk(day) {
  return day?.risk || exposureRisk(day?.exposureLoad || 0);
}

function dateFromRouteId(id) {
  const [year, month, day] = String(id || "").split("_").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatShortDate(date, chinese = false) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  if (chinese) return `${date.getMonth() + 1}月${date.getDate()}日`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRange(startDate, endDate, chinese = false) {
  if (!startDate || !endDate) return "";
  return `${formatShortDate(startDate, chinese)}–${formatShortDate(endDate, chinese)}`;
}

function periodGroupTitle(date, groupType, chinese = false) {
  if (groupType === "yearly") {
    return chinese ? `${date.getFullYear()}年` : `${date.getFullYear()}`;
  }

  return date.toLocaleDateString(chinese ? "zh-TW" : "en-US", {
    year: "numeric",
    month: "long",
  });
}

function buildSummaryGroups(days = [], groupType = "monthly", chinese = false) {
  const groups = new Map();

  days.forEach((day) => {
    const date = dateFromRouteId(day.id);
    if (!date) return;

    const groupId = groupType === "yearly"
      ? `${date.getFullYear()}`
      : `${date.getFullYear()}_${date.getMonth() + 1}`;

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: `${groupType}_${groupId}`,
        groupType,
        dayName: periodGroupTitle(date, groupType, chinese),
        date: "",
        startDate: date,
        endDate: date,
        km: 0,
        minutes: 0,
        exposureLoadSum: 0,
        exposureLoadCount: 0,
        pm25Sum: 0,
        pm25Count: 0,
        peak: 0,
        low: Number.POSITIVE_INFINITY,
        segments: 0,
        hits: 0,
        activeDays: 0,
        intervals: [],
        cityPath: [],
        isPersonal: false,
        durationSource: "aggregate",
      });
    }

    const group = groups.get(groupId);
    group.startDate = date < group.startDate ? date : group.startDate;
    group.endDate = date > group.endDate ? date : group.endDate;
    group.km += Number(day.km) || 0;
    group.minutes += Number(day.minutes) || 0;
    group.segments += Number(day.segments) || 0;
    group.hits += Number(day.hits) || 0;

    if (day.isPersonal) {
      group.isPersonal = true;
      group.activeDays += 1;
    }

    if (Number(day.exposureLoad) > 0) {
      group.exposureLoadSum += Number(day.exposureLoad);
      group.exposureLoadCount += 1;
    }

    if (Number(day.avgPm25) > 0) {
      group.pm25Sum += Number(day.avgPm25);
      group.pm25Count += 1;
    }

    if (Number(day.peak) > 0) group.peak = Math.max(group.peak, Number(day.peak));
    if (Number(day.low) > 0) group.low = Math.min(group.low, Number(day.low));

    (day.cityPath || []).forEach((city) => {
      if (city && group.cityPath[group.cityPath.length - 1] !== city) {
        group.cityPath.push(city);
      }
    });

    (day.intervals || []).forEach((interval) => {
      let aggregateInterval = group.intervals.find((item) => item.label === interval.label);
      if (!aggregateInterval) {
        aggregateInterval = {
          label: interval.label,
          km: 0,
          minutes: 0,
          hits: 0,
          exposureLoadSum: 0,
          exposureLoadCount: 0,
          exposureLoad: 0,
          avgPm25: 0,
        };
        group.intervals.push(aggregateInterval);
      }

      aggregateInterval.km += Number(interval.km) || 0;
      aggregateInterval.minutes += Number(interval.minutes) || 0;
      aggregateInterval.hits += Number(interval.hits) || 0;

      if (Number(interval.exposureLoad) > 0) {
        aggregateInterval.exposureLoadSum += Number(interval.exposureLoad);
        aggregateInterval.exposureLoadCount += 1;
      }
    });
  });

  return Array.from(groups.values()).map((group) => {
    const exposureLoad = group.exposureLoadCount > 0
      ? group.exposureLoadSum / group.exposureLoadCount
      : 0;
    const avgPm25 = group.pm25Count > 0
      ? group.pm25Sum / group.pm25Count
      : 0;
    const finalizedIntervals = group.intervals.map((interval) => {
      const intervalExposure = interval.exposureLoadCount > 0
        ? interval.exposureLoadSum / interval.exposureLoadCount
        : 0;

      return {
        ...interval,
        km: Number(interval.km.toFixed(2)),
        minutes: Math.round(interval.minutes),
        avgPm25: Number(intervalExposure.toFixed(1)),
        exposureLoad: Number(intervalExposure.toFixed(1)),
      };
    });

    return {
      ...group,
      date: formatRange(group.startDate, group.endDate, chinese),
      km: Number(group.km.toFixed(2)),
      minutes: Math.round(group.minutes),
      avgPm25: Number(avgPm25.toFixed(1)),
      exposureLoad: Number(exposureLoad.toFixed(1)),
      peak: Number(group.peak.toFixed(1)),
      low: group.low === Number.POSITIVE_INFINITY ? 0 : Number(group.low.toFixed(1)),
      intervals: finalizedIntervals,
      risk: exposureRisk(exposureLoad),
      source: group.isPersonal ? "samples" : "no data",
    };
  });
}

export default function SummaryPage() {
  const { prefs, t } = useAppPreferences();
  const { user, firebaseReady } = useAuth();
  const isChinese = prefs.chinese;
  const [summaries, setSummaries] = useState(() => buildAllSummaries());
  const [periodKey, setPeriodKey] = useState("weekly");

  const [expandedDay, setExpandedDay] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const refreshSummary = useCallback(async () => {
    setSummaryLoading(true);

    try {
      let routeMap = null;

      if (firebaseReady && user?.uid) {
        const routeIds = Array.from(
          { length: SUMMARY_PERIODS.yearly.days },
          (_, index) => routeDateId(index)
        );
        routeMap = await loadUserRouteHistory(user.uid, routeIds);
      }

      setSummaries(buildAllSummaries(routeMap));
    } catch (error) {
      console.warn("Unable to load cloud route history:", error);
      setSummaries(buildAllSummaries());
    } finally {
      setSummaryLoading(false);
    }
  }, [firebaseReady, user]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (!cancelled) await refreshSummary();
    });

    return () => {
      cancelled = true;
    };
  }, [refreshSummary]);

  const summary = summaries[periodKey] || buildWeeklySummary();
  const periodOptions = Object.values(SUMMARY_PERIODS);
  const activePeriod = SUMMARY_PERIODS[periodKey] || SUMMARY_PERIODS.weekly;
  const periodLabel = isChinese
    ? PERIOD_LABELS_ZH[periodKey]
    : activePeriod.label;
  const periodDaysLabel = activePeriod.shortLabel;
  const historyLogLabel = isChinese
    ? HISTORY_LOG_LABELS_ZH[periodKey] || HISTORY_LOG_LABELS_ZH.weekly
    : HISTORY_LOG_LABELS_EN[periodKey] || HISTORY_LOG_LABELS_EN.weekly;
  const displayedEntries = periodKey === "weekly"
    ? summary.days
    : buildSummaryGroups(summary.days, periodKey, isChinese);
  const today = summary.days[0] || {
    km: 0,
    exposureLoad: 0,
    avgPm25: 0,
    peak: 0,
    low: 0,
    minutes: 0,
    segments: 0,
    hits: 0,
    intervals: [],
    risk: { label: "LOW", color: "#34C759" },
  };

  const todayLocation = today.cityPath?.length > 0
    ? cityName(today.cityPath[today.cityPath.length - 1], isChinese)
    : t("Phone GPS", "手機 GPS");
  const maxExposure = Math.max(
    1,
    ...displayedEntries.map((day) => day.exposureLoad || 0)
  );

  return (
    <main className="app-root">
      <div className="phone-frame relative summary-native-frame">
        <section className="summary-native-scroll">
          <div className="records-native-page-header records-native-page-header-standard summary-native-page-header">
            <div>
              <p className="screen-kicker">{t("Telemetry", "數據")}</p>
              <h1 className="app-page-title">{t("Summary", "總覽")}</h1>
            </div>

            <button
              type="button"
              onClick={refreshSummary}
              className="records-native-refresh records-native-refresh-standard"
              title={t("Refresh summary", "重新整理總覽")}
            >
              <RefreshCw
                size={20}
                strokeWidth={3}
                className={summaryLoading ? "animate-spin" : ""}
              />
            </button>
          </div>

          <div className="summary-today-card">
            <div className="summary-today-gradient">
              <div className="summary-today-header">
                <p className="summary-today-label">{t("TODAY'S PM2.5 AVG", "今日 PM2.5 平均")}</p>
                <div className="summary-today-actions">
                  <button
                    type="button"
                    onClick={refreshSummary}
                    title={t("Refresh summary", "重新整理總覽")}
                  >
                    <RefreshCw
                      size={24}
                      strokeWidth={2.5}
                      className={summaryLoading ? "animate-spin" : ""}
                    />
                  </button>
                </div>
              </div>

              <div className="summary-today-main summary-today-main-single">
                <div>
                  <p className="summary-today-number">{today.avgPm25.toFixed(1)}</p>
                  <p className="summary-today-unit">µg/m³</p>
                </div>
              </div>

              <div className="summary-today-footer">
                <p className="summary-today-rating">
                  {t("PERSONAL EXPOSURE", "個人暴露")}
                </p>
                <p className="summary-today-location">
                  {today.isPersonal ? todayLocation : t("Phone GPS", "手機 GPS")} · {today.km} km · {today.minutes} {t("min", "分鐘")}
                </p>
              </div>
            </div>
          </div>

          <div className="summary-period-tabs" aria-label={t("Summary period", "總覽區間")}>
            {periodOptions.map((period) => (
              <button
                key={period.key}
                type="button"
                onClick={() => {
                  setPeriodKey(period.key);
                  setExpandedDay(null);
                }}
                className={[
                  "summary-period-tab",
                  periodKey === period.key ? "summary-period-tab-active" : "",
                ].join(" ")}
              >
                <span>{isChinese ? PERIOD_LABELS_ZH[period.key] : period.label}</span>
                <small>{period.shortLabel}</small>
              </button>
            ))}
          </div>

          <div className="summary-mini-grid summary-native-mini-grid">
            <div className="summary-mini-card">
              <Footprints className="forecast-icon-accent" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">{isChinese ? `${periodLabel}距離` : `${periodLabel} Distance`}</p>
              <p className="summary-mini-value">
                {summary.totalKm}
                <span className="summary-history-unit">KM</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <Gauge className="forecast-icon-accent" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">{isChinese ? `${periodLabel}PM 平均` : `${periodLabel} PM Avg`}</p>
              <p className="summary-mini-value">
                {summary.avgPm25}
                <span className="summary-history-unit">µg/m³</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <Activity className="forecast-icon-accent" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">{t("Peak PM2.5", "最高 PM2.5")}</p>
              <p className="summary-mini-value">
                {summary.peakPm25 || 0}
                <span className="summary-history-unit">µg/m³</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <CalendarDays className="forecast-icon-accent" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">{t("Active Days", "活動天數")}</p>
              <p className="summary-mini-value">
                {summary.activeDays}
                <span className="summary-history-unit">/{summary.dayCount || activePeriod.days}</span>
              </p>
            </div>
          </div>

          <div className="summary-native-heading-row">
            <div className="summary-native-heading-title">
              <BarChart3 className="forecast-icon-accent" size={22} strokeWidth={3} />
              <h2 className="summary-native-section-title">
                {historyLogLabel} ({periodDaysLabel})
              </h2>
            </div>
            <p className="summary-action-hint">{t("Tap to expand", "點擊展開")}</p>
          </div>

          <div className="summary-native-list">
            {displayedEntries.map((day) => {
              const risk = safeRisk(day);
              const expanded = expandedDay === day.id;
              const maxInterval = Math.max(
                1,
                ...(day.intervals || []).map((item) => item.exposureLoad || 0)
              );
              const title = day.groupType
                ? day.dayName
                : summaryDayName(day, isChinese);
              const subtitle = day.groupType
                ? `${day.date} · ${day.activeDays} ${t("active days", "活動天")} · ${day.km} km`
                : `${summaryDate(day, isChinese)} · ${day.km} km · ${day.minutes} ${t("min", "分鐘")}`;

              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setExpandedDay(expanded ? null : day.id)}
                  className="summary-history-card summary-native-day-card"
                >
                  <div className="summary-history-top">
                    <div className="min-w-0">
                      <p className="summary-history-date">
                        {title}
                      </p>
                      <p className="summary-history-sub">
                        {subtitle}
                      </p>
                    </div>

                    <div className="summary-native-day-summary">
                      <p className="summary-native-day-score">
                        {day.exposureLoad}
                        <span>µg/m³</span>
                      </p>

                      {expanded ? (
                        <ChevronUp size={20} className="summary-expand-icon" />
                      ) : (
                        <ChevronDown size={20} className="summary-expand-icon" />
                      )}
                    </div>
                  </div>

                  <div className="summary-progress-track summary-native-progress-track">
                    <div
                      className="summary-progress-fill"
                      style={{
                        width: `${Math.min(100, (day.exposureLoad / maxExposure) * 100)}%`,
                        backgroundColor: risk.color,
                      }}
                    />
                  </div>

                  {expanded && (
                    <div className="summary-native-details">
                      <div className="summary-native-chart-section">
                        <p className="summary-native-chart-title">{t("INTERVAL BREAKDOWN (6H)", "時段分析 (6小時)")}</p>
                        <div className="summary-native-chart-row">
                          {(day.intervals || []).map((interval) => {
                            return (
                              <div key={interval.label} className="summary-native-bar-container">
                                <div className="summary-native-bar-track">
                                  <div
                                    className="summary-native-bar-fill"
                                    style={{
                                      height: `${Math.max(5, Math.min(100, ((interval.exposureLoad || 0) / maxInterval) * 100))}%`,
                                      backgroundColor: exposureRisk(interval.exposureLoad || 0).color,
                                    }}
                                  />
                                </div>
                                <p className="summary-native-bar-label">{interval.label}</p>
                                <p className="summary-native-bar-value">{interval.exposureLoad > 0 ? interval.exposureLoad : "-"}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="summary-native-detail-grid">
                        <div>
                          <p className="summary-expanded-label">{t("Distance", "距離")}</p>
                          <p className="summary-expanded-value-small">{day.km} km</p>
                        </div>
                        <div>
                          <p className="summary-expanded-label">{t("Avg", "平均")}</p>
                          <p className="summary-expanded-value-small">{day.avgPm25}</p>
                        </div>
                        <div>
                          <p className="summary-expanded-label">{t("Peak", "最高")}</p>
                          <p className="summary-expanded-value-small">{day.peak}</p>
                        </div>
                        <div>
                          <p className="summary-expanded-label">{t("Low", "最低")}</p>
                          <p className="summary-expanded-value-small">{day.low}</p>
                        </div>
                      </div>

                      <div className="summary-native-source-row">
                        <p className="summary-inline-meta">
                          {t("Avg", "平均")} {day.avgPm25} · {t("Peak", "最高")} {day.peak} · {t("Low", "最低")} {day.low}
                        </p>

                        <span className="summary-source-chip">
                          {day.groupType
                            ? `${day.activeDays} ${t("active days", "活動天")}`
                            : day.routeSource
                            ? `${routeSourceName(day.routeSource, isChinese)} · ${transportName(day.routeMode, isChinese)}`
                            : day.isPersonal
                              ? t("phone GPS", "手機 GPS")
                              : t("no data", "無資料")}
                        </span>
                      </div>

                      <p className="summary-route-path">
                        {day.cityPath?.length > 0
                          ? `${day.groupType ? t("Sample cities", "採樣城市") : day.segments > 0 ? t("GPS route", "GPS 路線") : t("Sample cities", "採樣城市")}：${day.cityPath.map((city) => cityName(city, isChinese)).join(" → ")}`
                          : t("No PM2.5 samples recorded for this day.", "這一天沒有 PM2.5 採樣紀錄。")}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="summary-weekly-box">
            <p className="summary-weekly-text">
              {isChinese ? `${periodLabel}總計` : `${periodLabel.toUpperCase()} TOTAL`}: {summary.totalKm.toFixed(2)} KM | AVG {summary.avgPm25.toFixed(1)} PM2.5
            </p>
          </div>
        </section>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
