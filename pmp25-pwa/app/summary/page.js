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
import { buildWeeklySummary } from "@/lib/summaryStats";

function safeRisk(day) {
  return day?.risk || { label: "LOW", color: "#34C759" };
}

export default function SummaryPage() {
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
              <p className="screen-kicker">Statistics</p>
              <h1 className="app-page-title">Summary</h1>
            </div>

            <button
              onClick={refreshSummary}
              className="app-icon-button"
              title="Refresh summary"
            >
              <RefreshCw size={22} strokeWidth={3} />
            </button>
          </div>

          <div className="summary-hero mt-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="summary-hero-label">Today&apos;s Exposure Load</p>

                <p className="summary-hero-value">
                  {today.exposureLoad}
                  <span className="summary-hero-unit">score</span>
                </p>

                <p className="mt-3 text-sm font-bold text-white/75">
                  {today.km} km · {today.minutes} min · {today.segments} segments
                </p>
              </div>

              <span
                className="summary-risk-chip mt-1"
                style={{ backgroundColor: safeRisk(today).color }}
              >
                {safeRisk(today).label}
              </span>
            </div>
          </div>

          <div className="summary-mini-grid mt-5">
            <div className="summary-mini-card">
              <Footprints className="text-[#00D2FF]" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">Weekly Distance</p>
              <p className="summary-mini-value">
                {summary.totalKm}
                <span className="summary-history-unit">KM</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <Gauge className="text-[#00D2FF]" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">Weekly Load</p>
              <p className="summary-mini-value">
                {summary.totalExposure}
                <span className="summary-history-unit">score</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <Activity className="text-[#00D2FF]" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">Avg PM2.5</p>
              <p className="summary-mini-value">
                {summary.avgPm25}
                <span className="summary-history-unit">µg/m³</span>
              </p>
            </div>

            <div className="summary-mini-card">
              <CalendarDays className="text-[#00D2FF]" size={21} strokeWidth={3} />
              <p className="summary-mini-label mt-4">Active Days</p>
              <p className="summary-mini-value">
                {summary.activeDays}
                <span className="summary-history-unit">/7</span>
              </p>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-[#00D2FF]" size={22} strokeWidth={3} />
              <h2 className="app-section-title">History Log</h2>
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
              Tap to expand
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
                        {day.dayName}
                      </p>
                      <p className="summary-history-sub">
                        {day.date} · {day.segments} segments · {day.hits} samples
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="summary-history-value">
                        {day.exposureLoad}
                        <span className="summary-history-unit">score</span>
                      </p>

                      <div className="mt-2 flex items-center justify-end gap-2">
                        <span
                          className="summary-risk-chip"
                          style={{ backgroundColor: risk.color }}
                        >
                          {risk.label}
                        </span>

                        {expanded ? (
                          <ChevronUp size={16} className="text-white/40" />
                        ) : (
                          <ChevronDown size={16} className="text-white/40" />
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
                          <p className="summary-expanded-label">Distance</p>
                          <p className="summary-expanded-value-small">
                            {day.km} km
                          </p>
                        </div>

                        <div>
                          <p className="summary-expanded-label">Avg</p>
                          <p className="summary-expanded-value-small">
                            {day.avgPm25}
                          </p>
                        </div>

                        <div>
                          <p className="summary-expanded-label">Peak</p>
                          <p className="summary-expanded-value-small">
                            {day.peak}
                          </p>
                        </div>

                        <div>
                          <p className="summary-expanded-label">Low</p>
                          <p className="summary-expanded-value-small">
                            {day.low}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-white/45">
                          {day.hits} samples · {day.minutes} min
                        </p>

                        <span className="summary-source-chip">
                          {day.isPersonal ? "personal route" : "no data"}
                        </span>
                      </div>

                      <div className="interval-box">
                        <div className="interval-title-row">
                          <p className="interval-title">Interval breakdown</p>
                          <p className="text-[9px] font-bold text-white/38">
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
                This follows the original Summary structure: daily history log,
                collapsible details, peak/low/average values, and interval
                breakdowns. The next improvement is storing real PM2.5 per
                route segment from Home.
              </p>
            </div>
          </div>
        </section>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
