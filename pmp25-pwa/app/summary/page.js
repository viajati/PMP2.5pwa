"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Share2,
  X,
} from "lucide-react";
import OriginalBottomNav from "@/components/OriginalBottomNav";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { useAuth } from "@/components/AuthProvider";
import { buildWeeklySummary } from "@/lib/summaryStats";
import { loadUserRouteHistory } from "@/lib/firebaseData";
import { routeDateId } from "@/lib/trackStorage";
import {
  cityName,
  summaryDate,
  summaryDayName,
} from "@/lib/i18n";

function pm25Condition(avg = 0, chinese = false) {
  if (avg === 0) return { label: chinese ? "無數據" : "NO DATA", color: "#8E8E93" };
  if (avg <= 15.4) return { label: chinese ? "優良" : "EXCELLENT", color: "#34C759" };
  if (avg <= 35.4) return { label: chinese ? "普通" : "FAIR", color: "#FFCC00" };
  if (avg <= 54.4) return { label: chinese ? "不佳" : "POOR", color: "#FF9500" };
  return { label: chinese ? "危害" : "HAZARDOUS", color: "#FF3B30" };
}

export default function SummaryPage() {
  const { prefs, t } = useAppPreferences();
  const { user, firebaseReady } = useAuth();
  const isChinese = prefs.chinese;
  const [summary, setSummary] = useState({
    days: [],
    totalKm: 0,
    totalExposure: 0,
    activeDays: 0,
    avgPm25: 0,
  });

  const [expandedDay, setExpandedDay] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const refreshSummary = useCallback(async () => {
    setSummaryLoading(true);

    try {
      let routeMap = null;

      if (firebaseReady && user?.uid) {
        const routeIds = Array.from({ length: 7 }, (_, index) => routeDateId(index));
        routeMap = await loadUserRouteHistory(user.uid, routeIds);
      }

      setSummary(buildWeeklySummary(routeMap));
    } catch (error) {
      console.warn("Unable to load cloud route history:", error);
      setSummary(buildWeeklySummary());
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

  const todayMeta = pm25Condition(today.avgPm25, isChinese);
  const todayLocation = today.cityPath?.length > 0
    ? cityName(today.cityPath[today.cityPath.length - 1], isChinese)
    : t("Phone GPS", "手機 GPS");

  return (
    <main className="app-root">
      <div className="phone-frame relative summary-native-frame">
        <section className="summary-native-scroll">
          <div className="summary-today-card">
            <div className="summary-today-gradient">
              <div className="summary-today-header">
                <p className="summary-today-label">{t("TODAY'S STATUS", "今日狀態")}</p>
                <div className="summary-today-actions">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    title={t("Share telemetry", "分享數據")}
                  >
                    <Share2 size={24} strokeWidth={2.5} />
                  </button>
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

              <div className="summary-today-main">
                <div>
                  <p className="summary-today-number">
                    {today.km > 0 && today.km < 0.1 ? today.km.toFixed(2) : today.km.toFixed(1)}
                  </p>
                  <p className="summary-today-unit">{t("KM WALKED", "步行公里")}</p>
                </div>

                <span className="summary-today-divider" />

                <div>
                  <p className="summary-today-number">{today.avgPm25.toFixed(1)}</p>
                  <p className="summary-today-unit">{t("AVG PM2.5", "平均 PM2.5")}</p>
                </div>
              </div>

              <div className="summary-today-footer">
                <p className="summary-today-rating">
                  {isChinese ? `狀況：${todayMeta.label}` : `CONDITION: ${todayMeta.label}`}
                </p>
                <p className="summary-today-location">
                  {today.isPersonal ? t("PERSONAL JOURNEY", "個人足跡") : todayLocation}
                </p>
              </div>
            </div>
          </div>

          <div className="summary-native-heading-row">
            <h2 className="summary-native-section-title">{t("HISTORY LOG (7D)", "歷史紀錄 (7天)")}</h2>
            <p className="summary-action-hint">{t("Tap to expand", "點擊展開")}</p>
          </div>

          <div className="summary-native-list">
            {summary.days.map((day) => {
              const condition = pm25Condition(day.avgPm25, isChinese);
              const expanded = expandedDay === day.id;

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
                        {summaryDayName(day, isChinese)}
                      </p>
                      <p className="summary-history-sub">
                        {summaryDate(day, isChinese)}
                      </p>
                    </div>

                    <div className="summary-native-day-summary">
                      <p className="summary-native-day-km">
                        {day.km > 0 && day.km < 0.1 ? day.km.toFixed(2) : day.km.toFixed(1)} km
                      </p>

                      <span className="summary-status-dot" style={{ backgroundColor: condition.color }} />

                      <p className="summary-native-day-avg" style={{ color: condition.color }}>
                        {day.avgPm25.toFixed(1)}
                      </p>

                      {expanded ? (
                        <ChevronUp size={20} className="summary-expand-icon" />
                      ) : (
                        <ChevronDown size={20} className="summary-expand-icon" />
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="summary-native-details">
                      <div className="summary-native-chart-section">
                        <p className="summary-native-chart-title">{t("INTERVAL BREAKDOWN (6H)", "時段分析 (6小時)")}</p>
                        <div className="summary-native-chart-row">
                          {(day.intervals || []).map((interval) => {
                            const barMeta = pm25Condition(interval.avgPm25, isChinese);
                            return (
                              <div key={interval.label} className="summary-native-bar-container">
                                <div className="summary-native-bar-track">
                                  <div
                                    className="summary-native-bar-fill"
                                    style={{
                                      height: `${Math.max(5, Math.min(100, ((interval.avgPm25 || 0) / 60) * 100))}%`,
                                      backgroundColor: barMeta.color,
                                    }}
                                  />
                                </div>
                                <p className="summary-native-bar-label">{interval.label}</p>
                                <p className="summary-native-bar-value">{interval.avgPm25 > 0 ? interval.avgPm25.toFixed(1) : "-"}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="summary-native-detail-grid">
                        <div>
                          <p className="summary-expanded-label">{t("Peak", "最高值")}</p>
                          <p className="summary-expanded-value-small">{day.peak.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="summary-expanded-label">{t("Lowest", "最低值")}</p>
                          <p className="summary-expanded-value-small">{day.low.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="summary-expanded-label">{t("Steps (est)", "步數 (預估)")}</p>
                          <p className="summary-expanded-value-small">{(day.km * 1350).toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="summary-expanded-label">{t("Samples", "樣本數")}</p>
                          <p className="summary-expanded-value-small">{day.hits}</p>
                        </div>
                      </div>

                      <p className="summary-route-path">
                        {day.cityPath?.length > 0
                          ? `${t("GPS route", "GPS 路線")}：${day.cityPath.map((city) => cityName(city, isChinese)).join(" → ")}`
                          : t("No real GPS route recorded for this day.", "這一天沒有真實 GPS 路線紀錄。")}
                      </p>

                      <p className="summary-inline-meta mt-2">
                        {day.durationSource === "timestamp"
                          ? t("Duration comes from phone GPS timestamps.", "時間由手機 GPS 時間戳計算。")
                          : day.durationSource === "road"
                            ? t("Distance and duration use the road route calculated from real GPS points.", "距離與時間使用真實 GPS 點計算出的道路路線。")
                          : day.isPersonal
                            ? t("Duration is estimated from distance because timestamp gaps were unavailable.", "因缺少可用時間戳，時間由距離估算。")
                          : t("Allow GPS on Home and move with the phone to build this history automatically.", "在首頁允許 GPS 並帶著手機移動後，這裡會自動建立歷史。")}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="summary-weekly-box">
            <p className="summary-weekly-text">
              {t("WEEKLY TOTAL", "每週總計")}: {summary.totalKm.toFixed(2)} KM | AVG {summary.avgPm25.toFixed(1)} PM2.5
            </p>
          </div>
        </section>

        {showShareModal && (
          <div className="summary-share-modal" role="dialog" aria-modal="true">
            <div className="summary-share-card">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="summary-share-close"
                title={t("Close", "關閉")}
              >
                <X size={18} strokeWidth={3} />
              </button>
              <p className="summary-share-title">{t("SHARE TELEMETRY", "分享數據紀錄")}</p>
              <p className="summary-share-subtitle">{t("Personal environmental summary", "個人環境數據摘要")}</p>
              <div className="summary-faux-qr" aria-label={JSON.stringify({ km: today.km, avg: today.avgPm25 })}>
                {Array.from({ length: 49 }).map((_, index) => (
                  <span
                    key={index}
                    className={(index * 7 + Math.round(today.km * 10) + Math.round(today.avgPm25)) % 3 === 0 ? "summary-qr-cell-on" : ""}
                  />
                ))}
              </div>
              <div className="summary-share-stats">
                <div>
                  <p>{today.km.toFixed(1)}</p>
                  <span>KM</span>
                </div>
                <div>
                  <p>{today.avgPm25.toFixed(0)}</p>
                  <span>PM2.5</span>
                </div>
              </div>
              <p className="summary-share-footer">BLUE SKY TELEMETRY · SYNC V1.0</p>
            </div>
          </div>
        )}

        <OriginalBottomNav />
      </div>
    </main>
  );
}
