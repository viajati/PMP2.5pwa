"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Footprints,
  Gauge,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import OriginalBottomNav from "@/components/OriginalBottomNav";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { buildWeeklySummary } from "@/lib/summaryStats";
import { riskName, summaryDate, summaryDayName } from "@/lib/i18n";

function safeRisk(day) {
  return day?.risk || { label: "LOW", color: "#34C759" };
}

export default function SummaryPage() {
  const { prefs, t } = useAppPreferences();
  const isChinese = prefs.chinese;
  const [summary, setSummary] = useState({
    days: [],
    totalKm: 0,
    totalExposure: 0,
    activeDays: 0,
    avgPm25: 0,
  });

  const [expandedDay, setExpandedDay] = useState(null);

  function refreshSummary() {
    setSummary(buildWeeklySummary());
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) refreshSummary();
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const maxExposure = Math.max(
    1,
    ...summary.days.map((day) => day.exposureLoad || 0)
  );

  return (
    <main className="app-root">
      <div className="phone-frame relative">
        <section className="app-page-body">
          <div className="app-page-header">
            <div>
              <p className="screen-kicker">{t("Statistics", "統計")}</p>
              <h1 className="app-page-title">{t("Summary", "總覽")}</h1>
            </div>

            <button
              onClick={refreshSummary}
              className="app-icon-button"
              title={t("Refresh summary", "重新整理總覽")}
            >
              <RefreshCw size={22} strokeWidth={3} />
            </button>
          </div>

          <div className="summary-hero mt-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="summary-hero-label">{t("Today's Exposure Load", "今日暴露負荷")}</p>

                <p className="summary-hero-value">
                  {today.exposureLoad}
                  <span className="summary-hero-unit">{t("score", "分")}</span>
                </p>

                <p className="summary-hero-meta">
                  {today.km} km · {today.minutes} {t("min", "分鐘")} · {today.segments} {t("segments", "路段")}
                </p>
              </div>

              <span
                className="summary-risk-chip mt-1"
                style={{ backgroundColor: safeRisk(today).color }}
              >
                {riskName(safeRisk(today).label, isChinese)}
              </span>
            </div>
          </div>

          <div className="summary-mini-grid mt-5">
            <div className="summary-mini-card">
              <Footprints className="forecast-icon-accent" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">{t("Weekly Distance", "每週距離")}</p>
              <p className="summary-mini-value">
                {summary.totalKm}
                <span className="summary-history-unit">KM</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <Gauge className="forecast-icon-accent" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">{t("Weekly Load", "每週負荷")}</p>
              <p className="summary-mini-value">
                {summary.totalExposure}
                <span className="summary-history-unit">{t("score", "分")}</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <Activity className="forecast-icon-accent" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">{t("Avg PM2.5", "平均 PM2.5")}</p>
              <p className="summary-mini-value">
                {summary.avgPm25}
                <span className="summary-history-unit">µg/m³</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <CalendarDays className="forecast-icon-accent" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">{t("Active Days", "活動天數")}</p>
              <p className="summary-mini-value">
                {summary.activeDays}
                <span className="summary-history-unit">/7</span>
              </p>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="forecast-icon-accent" size={22} strokeWidth={3} />
              <h2 className="app-section-title">{t("History Log", "歷史紀錄")}</h2>
            </div>

            <p className="summary-action-hint">
              {t("Tap to expand", "點擊展開")}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {summary.days.map((day) => {
              const risk = safeRisk(day);
              const expanded = expandedDay === day.id;

              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setExpandedDay(expanded ? null : day.id)}
                  className="summary-history-card w-full text-left"
                >
                  <div className="summary-history-top">
                    <div className="min-w-0">
                      <p className="summary-history-date">
                        {summaryDayName(day, isChinese)}
                      </p>
                      <p className="summary-history-sub">
                        {summaryDate(day, isChinese)} · {day.segments} {t("segments", "路段")} · {day.hits} {t("samples", "樣本")}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="summary-history-value">
                        {day.exposureLoad}
                        <span className="summary-history-unit">{t("score", "分")}</span>
                      </p>

                      <div className="mt-2 flex items-center justify-end gap-2">
                        <span
                          className="summary-risk-chip"
                          style={{ backgroundColor: risk.color }}
                        >
                          {riskName(risk.label, isChinese)}
                        </span>

                        {expanded ? (
                          <ChevronUp size={16} className="summary-expand-icon" />
                        ) : (
                          <ChevronDown size={16} className="summary-expand-icon" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="summary-progress-track">
                    <div
                      className="summary-progress-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          (day.exposureLoad / maxExposure) * 100
                        )}%`,
                        backgroundColor: risk.color,
                      }}
                    />
                  </div>

                  {expanded && (
                    <div className="summary-expanded-box">
                      <div className="summary-expanded-grid-4">
                        <div>
                          <p className="summary-expanded-label">{t("Distance", "距離")}</p>
                          <p className="summary-expanded-value-small">
                            {day.km} km
                          </p>
                        </div>

                        <div>
                          <p className="summary-expanded-label">{t("Avg", "平均")}</p>
                          <p className="summary-expanded-value-small">
                            {day.avgPm25}
                          </p>
                        </div>

                        <div>
                          <p className="summary-expanded-label">{t("Peak", "最高")}</p>
                          <p className="summary-expanded-value-small">
                            {day.peak}
                          </p>
                        </div>

                        <div>
                          <p className="summary-expanded-label">{t("Low", "最低")}</p>
                          <p className="summary-expanded-value-small">
                            {day.low}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="summary-inline-meta">
                          {day.hits} {t("samples", "樣本")} · {day.minutes} {t("min", "分鐘")}
                        </p>

                        <span className="summary-source-chip">
                          {day.isPersonal ? t("personal route", "個人路線") : t("no data", "無資料")}
                        </span>
                      </div>

                      <div className="interval-box">
                        <div className="interval-title-row">
                          <p className="interval-title">{t("Interval breakdown", "時段分析")}</p>
                          <p className="interval-subtitle">
                            PM2.5 + load
                          </p>
                        </div>

                        {(day.intervals || []).map((interval) => {
                          const maxInterval = Math.max(
                            1,
                            ...(day.intervals || []).map(
                              (item) => item.exposureLoad || 0
                            )
                          );

                          return (
                            <div key={interval.label} className="interval-row">
                              <p className="interval-label">{interval.label}</p>

                              <div className="interval-track">
                                <div
                                  className="interval-fill"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (interval.exposureLoad / maxInterval) * 100
                                    )}%`,
                                    backgroundColor: risk.color,
                                  }}
                                />
                              </div>

                              <p className="interval-value">
                                {interval.exposureLoad}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="app-notice mt-5">
            <div className="app-notice-content">
              <ShieldAlert className="app-notice-icon" size={22} />
              <p className="app-notice-text">
                {t(
                  "This follows the original Summary structure: daily history log, collapsible details, peak/low/average values, and interval breakdowns. The next improvement is storing real PM2.5 per route segment from Home.",
                  "這裡保留原本的總覽結構：每日歷史紀錄、可展開細節、最高 / 最低 / 平均值與時段分析。下一步可以從首頁儲存每段路線的真實 PM2.5。"
                )}
              </p>
            </div>
          </div>
        </section>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
