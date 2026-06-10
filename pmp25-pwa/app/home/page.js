"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
  Car,
  ChevronDown,
  ChevronUp,
  Footprints,
  Gamepad2,
  LocateFixed,
  MapPin,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import OriginalBottomNav from "@/components/OriginalBottomNav";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { useAuth } from "@/components/AuthProvider";
import {
  CITY_COORDS,
  REGION_NAMES,
  getFilteredCities,
  getNearestCity,
} from "@/lib/cities";
import { cityName, regionName, routeSourceName, transportName } from "@/lib/i18n";
import {
  appendPm25Sample,
  appendPoint,
  appendSimulationPoint,
  calculateDistanceKm,
  clearTodaySimulationRoute,
  clearTodayRoute,
  getTodayRouteId,
  getTodayDistance,
  loadTodayPm25Samples,
  loadTodaySimulationRoute,
  loadTodayRoute,
  saveTodaySimulationRoute,
  saveTodayRoute,
  saveTodayRouteSummary,
} from "@/lib/trackStorage";
import { fetchHourlyAirQuality } from "@/lib/airQuality";
import { buildRouteStats } from "@/lib/summaryStats";
import {
  fetchRoute,
  routeDurationForMode,
} from "@/lib/routePlanner";
import {
  deleteUserRoute,
  saveUserRoute,
} from "@/lib/firebaseData";

const TaiwanMap = dynamic(() => import("@/components/TaiwanMap"), {
  ssr: false,
});

const HOME_ROUTE_MODES = [
  { id: "car", Icon: Car },
  { id: "bike", Icon: Bike },
  { id: "walk", Icon: Footprints },
];

const MIN_ROUTED_SEGMENT_KM = 0.05;
const PM25_SAMPLE_INTERVAL_MS = 10 * 60 * 1000;

function routePointKey(point) {
  return `${Number(point.latitude).toFixed(5)},${Number(point.longitude).toFixed(5)}`;
}

function routeCacheKey(start, end, mode) {
  return `${mode}:${routePointKey(start)}>${routePointKey(end)}`;
}

function compactRoutePoints(route) {
  if (!route || route.length <= 2) return route || [];

  const points = [route[0]];

  for (let index = 1; index < route.length - 1; index += 1) {
    const point = route[index];
    const previous = points[points.length - 1];

    if (calculateDistanceKm(previous, point) >= MIN_ROUTED_SEGMENT_KM) {
      points.push(point);
    }
  }

  const last = route[route.length - 1];
  if (routePointKey(points[points.length - 1]) !== routePointKey(last)) {
    points.push(last);
  }

  return points;
}

function cityPathFromPoints(route = []) {
  return route.reduce((path, point) => {
    if (!Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude)) {
      return path;
    }

    const city = point.city || getNearestCity(point.latitude, point.longitude);
    if (city && city !== path[path.length - 1]) path.push(city);

    return path;
  }, []);
}

function visibleCityPath(path = [], expanded = false) {
  if (expanded || path.length <= 5) return path;

  return [...path.slice(0, 3), "__more__", path[path.length - 1]];
}

function fallbackRouteSegment(start, end, mode) {
  const distance = calculateDistanceKm(start, end);

  return {
    coords: [start, end],
    distance,
    duration: routeDurationForMode(mode, distance, distance * 1.4),
    source: "GPS estimate",
  };
}

function pointPm25(point) {
  const value = Number(point?.pm25);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function rowTimeMs(row) {
  const parsed = new Date(row?.time).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function currentHourlyRow(rows = []) {
  const orderedRows = rows
    .filter((row) => Number.isFinite(Number(row?.pm25)) && Number(row.pm25) > 0)
    .sort((a, b) => (rowTimeMs(a) || 0) - (rowTimeMs(b) || 0));

  if (!orderedRows.length) return null;

  const now = Date.now();
  const latestCurrentRow = [...orderedRows]
    .reverse()
    .find((row) => {
      const time = rowTimeMs(row);
      return time !== null && time <= now;
    });

  return latestCurrentRow || orderedRows[0];
}

async function fetchCurrentCityAirSample(city) {
  try {
    const rows = await fetchHourlyAirQuality(city);
    const row = currentHourlyRow(rows);
    if (!row) return null;

    return {
      ...row,
      apiTime: row.time,
      observedAt: rowTimeMs(row) || null,
      timestamp: Date.now(),
      pm25: Number(Number(row.pm25).toFixed(1)),
    };
  } catch {
    return null;
  }
}

async function estimateCityPm25(city) {
  const sample = await fetchCurrentCityAirSample(city);
  return sample?.pm25 || 0;
}

function calculateRoadExposure(routePoints, routedSegments, mode, fallbackStats) {
  if (!routedSegments?.length) return fallbackStats;

  let distance = 0;
  let minutes = 0;
  const pmValues = [];
  let peak = 0;
  let low = Number.POSITIVE_INFINITY;

  routedSegments.forEach((segment, index) => {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const pm25 =
      pointPm25(end) ||
      pointPm25(start) ||
      fallbackStats.avgPm25 ||
      0;

    distance += segment.distance;
    minutes += segment.duration;
    pmValues.push(pm25);
    peak = Math.max(peak, pm25);
    low = Math.min(low, pm25);
  });

  const avgPm25 = pmValues.length > 0
    ? pmValues.reduce((sum, value) => sum + value, 0) / pmValues.length
    : fallbackStats.avgPm25;

  return {
    ...fallbackStats,
    km: Number(distance.toFixed(2)),
    minutes: Math.round(minutes),
    exposureLoad: Number(avgPm25.toFixed(1)),
    avgPm25: Number(avgPm25.toFixed(1)),
    peak: Number((peak || fallbackStats.peak || 0).toFixed(1)),
    low: Number((low === Number.POSITIVE_INFINITY ? fallbackStats.low || 0 : low).toFixed(1)),
  };
}

export default function HomePage() {
  const { prefs, t } = useAppPreferences();
  const { user, firebaseReady } = useAuth();
  const isChinese = prefs.chinese;
  const [location, setLocation] = useState({
    latitude: 23.5,
    longitude: 121.0,
  });
  const locationRef = useRef(location);

  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [isSearching, setIsSearching] = useState(false);

  const [todayPath, setTodayPath] = useState([]);
  const [distance, setDistance] = useState(0);
  const [simulationPath, setSimulationPath] = useState([]);
  const [simulationDistance, setSimulationDistance] = useState(0);
  const [routeMode, setRouteMode] = useState("walk");
  const [roadRoute, setRoadRoute] = useState(null);
  const [roadRoutingLoading, setRoadRoutingLoading] = useState(false);
  const routeCacheRef = useRef(new Map());
  const [simulationHelpOpen, setSimulationHelpOpen] = useState(false);
  const [homeInfoOpen, setHomeInfoOpen] = useState(false);
  const [routePathOpen, setRoutePathOpen] = useState(false);

  const [currentCity, setCurrentCity] = useState("Taiwan");
  const [routeLoad, setRouteLoad] = useState(null);
  const [routeLoadLoading, setRouteLoadLoading] = useState(false);
  const [pm25SampleCount, setPm25SampleCount] = useState(0);

  const [teleopMode, setTeleopMode] = useState(false);
  const [teleopPos, setTeleopPos] = useState(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [recenterTarget, setRecenterTarget] = useState(null);
  const todayRouteId = useMemo(() => getTodayRouteId(), []);

  const filteredCities = useMemo(() => {
    return getFilteredCities(search, selectedRegion, isChinese);
  }, [search, selectedRegion, isChinese]);
  const activePath = teleopMode ? simulationPath : todayPath;
  const activeDistance = teleopMode ? simulationDistance : distance;

  const syncCloudRoute = useCallback((route, summary = {}) => {
    if (!firebaseReady || !user?.uid) return;

    saveUserRoute(user.uid, todayRouteId, route, summary).catch((error) => {
      console.warn("Unable to sync cloud route:", error);
    });
  }, [firebaseReady, todayRouteId, user]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const collectPm25Sample = useCallback(async () => {
    if (teleopMode || !CITY_COORDS[currentCity]) return null;

    const airSample = await fetchCurrentCityAirSample(currentCity);
    if (!airSample) return null;

    const sampleLocation = locationRef.current || CITY_COORDS[currentCity];

    return appendPm25Sample({
      ...airSample,
      city: currentCity,
      latitude: sampleLocation.latitude,
      longitude: sampleLocation.longitude,
      routeKind: "gps",
    }, todayRouteId);
  }, [currentCity, teleopMode, todayRouteId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeSearch();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const savedRoute = loadTodayRoute();
      const savedSimulationRoute = loadTodaySimulationRoute();
      setTodayPath(savedRoute);
      setDistance(getTodayDistance(savedRoute));
      setSimulationPath(savedSimulationRoute);
      setSimulationDistance(getTodayDistance(savedSimulationRoute));
    });

    if (!navigator.geolocation) {
      queueMicrotask(() => {
        if (cancelled) return;

        setCurrentCity("Hsinchu City");
        setLocation(CITY_COORDS["Hsinchu City"]);
      });

      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(nextLocation);
        const nearestCity = getNearestCity(
          nextLocation.latitude,
          nextLocation.longitude
        );
        setCurrentCity(nearestCity);

        const result = appendPoint(
          nextLocation.latitude,
          nextLocation.longitude,
          {
            accuracy: position.coords.accuracy ?? null,
            city: nearestCity,
          }
        );
        syncCloudRoute(result.route, {
          distanceKm: Number(result.distance.toFixed(2)),
          routeKind: "gps",
        });
        setTodayPath(result.route);
        setDistance(result.distance);
      },
      () => {
        setCurrentCity("Hsinchu City");
        setLocation(CITY_COORDS["Hsinchu City"]);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        const nearestCity = getNearestCity(
          nextLocation.latitude,
          nextLocation.longitude
        );

        const result = appendPoint(
          nextLocation.latitude,
          nextLocation.longitude,
          {
            accuracy: position.coords.accuracy ?? null,
            city: nearestCity,
          }
        );
        syncCloudRoute(result.route, {
          distanceKm: Number(result.distance.toFixed(2)),
          routeKind: "gps",
        });
        setTodayPath(result.route);
        setDistance(result.distance);

        if (!teleopMode) {
          setLocation(nextLocation);
          setCurrentCity(nearestCity);
        }
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [syncCloudRoute, teleopMode]);

  useEffect(() => {
    if (teleopMode) return undefined;

    let alive = true;

    async function sampleNow() {
      const samples = await collectPm25Sample();
      if (alive && samples) {
        setPm25SampleCount(samples.length);
      }
    }

    sampleNow();
    const timer = window.setInterval(sampleNow, PM25_SAMPLE_INTERVAL_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [collectPm25Sample, teleopMode]);

  useEffect(() => {
    let cancelled = false;
    const routePoints = compactRoutePoints(activePath);

    if (routePoints.length < 2) {
      queueMicrotask(() => {
        if (cancelled) return;
        setRoadRoute(null);
        setRoadRoutingLoading(false);
      });

      return undefined;
    }

    queueMicrotask(() => {
      if (!cancelled) setRoadRoutingLoading(true);
    });

    const timer = window.setTimeout(async () => {
      try {
        const segments = [];
        const coords = [];
        let distance = 0;
        let duration = 0;
        let source = "OSRM";

        for (let index = 1; index < routePoints.length; index += 1) {
          if (cancelled) return;

          const start = routePoints[index - 1];
          const end = routePoints[index];
          const key = routeCacheKey(start, end, routeMode);

          let segment = routeCacheRef.current.get(key);

          if (!segment) {
            segment = await fetchRoute(start, end, routeMode);
            if (!segment) segment = fallbackRouteSegment(start, end, routeMode);
            routeCacheRef.current.set(key, segment);
          }

          segments.push(segment);
          distance += segment.distance;
          duration += segment.duration;

          if (segment.source !== "OSRM") source = "GPS estimate";

          const segmentCoords = segment.coords?.length
            ? segment.coords
            : [start, end];
          coords.push(...(coords.length ? segmentCoords.slice(1) : segmentCoords));
        }

        if (cancelled) return;

        setRoadRoute({
          coords,
          distance: Number(distance.toFixed(2)),
          duration,
          routePoints,
          segments,
          source,
        });
      } finally {
        if (!cancelled) setRoadRoutingLoading(false);
      }
    }, 550);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activePath, routeMode]);

  useEffect(() => {
    let alive = true;

    async function calculateRouteExposureLoad() {
      if (!CITY_COORDS[currentCity]) {
        setRouteLoad(null);
        return;
      }

      setRouteLoadLoading(true);

      try {
        const uniqueCities = new Set([currentCity]);

        for (let i = 0; i < activePath.length; i += 1) {
          const point = activePath[i];
          const city = getNearestCity(point.latitude, point.longitude);
          if (CITY_COORDS[city]) uniqueCities.add(city);
        }

        const cityPmMap = {};

        await Promise.all(
          Array.from(uniqueCities).map(async (city) => {
            cityPmMap[city] = await estimateCityPm25(city);
          })
        );

        const currentCityPm25 = cityPmMap[currentCity] || 0;
        const currentCityExposure = Number(currentCityPm25.toFixed(1));
        const pm25Samples = teleopMode ? [] : loadTodayPm25Samples();

        let routeMetadataChanged = false;
        const enrichedRoute = activePath.map((point) => {
          const pointCity = point.city || getNearestCity(point.latitude, point.longitude);
          const pointPm25 = cityPmMap[pointCity] || currentCityPm25 || 0;
          const roundedPm25 = Number(pointPm25.toFixed(1));
          const nextPoint = {
            ...point,
            city: pointCity,
            pm25: roundedPm25,
          };

          if (point.city !== nextPoint.city || point.pm25 !== nextPoint.pm25) {
            routeMetadataChanged = true;
          }

          return nextPoint;
        });

        const baseStats = buildRouteStats(enrichedRoute, {
          avgPm25: currentCityPm25 || 0,
          pm25Samples,
        });
        const enrichedRoadPoints = roadRoute?.routePoints?.map((point) => {
          const pointCity = point.city || getNearestCity(point.latitude, point.longitude);
          const pointPm25 = cityPmMap[pointCity] || currentCityPm25 || 0;

          return {
            ...point,
            city: pointCity,
            pm25: Number(pointPm25.toFixed(1)),
          };
        });
        const routedStats = roadRoute
          ? calculateRoadExposure(
              enrichedRoadPoints,
              roadRoute.segments,
              routeMode,
              baseStats
            )
          : baseStats;
        const stats = pm25Samples.length > 0
          ? {
              ...routedStats,
              avgPm25: baseStats.avgPm25,
              exposureLoad: baseStats.exposureLoad,
              peak: baseStats.peak,
              low: baseStats.low,
              hits: baseStats.hits,
              intervals: baseStats.intervals,
              cityPath: baseStats.cityPath.length > 0 ? baseStats.cityPath : routedStats.cityPath,
              sampleCount: baseStats.sampleCount,
              pm25SampleCount: baseStats.pm25SampleCount,
            }
          : routedStats;
        const routeSummary = {
          distanceKm: stats.km,
          routeMinutes: stats.minutes,
          exposureLoad: stats.exposureLoad,
          avgPm25: stats.avgPm25,
          peakPm25: stats.peak,
          lowPm25: stats.low,
          segmentCount: stats.segments,
          samples: stats.hits,
          pm25Samples,
          pm25SampleCount: pm25Samples.length,
          cityPath: stats.cityPath,
          durationSource: stats.durationSource,
          routeMode,
          routeSource: pm25Samples.length > 0 && enrichedRoute.length < 2
            ? "Time samples"
            : roadRoute?.source || "GPS samples",
          routeKind: teleopMode ? "simulation" : "gps",
          calculation: {
            distance: roadRoute
              ? "road-route distance between GPS points"
              : "GPS point-to-point distance",
            duration: roadRoute
              ? `${transportName(routeMode, false)} route duration`
              : stats.durationSource,
            exposure: "time-based PM2.5 average from 10-minute city/location samples",
          },
          updatedAt: Date.now(),
        };

        if (!alive) return;

        if (!teleopMode && (enrichedRoute.length > 0 || pm25Samples.length > 0)) {
          saveTodayRouteSummary(routeSummary);
          syncCloudRoute(enrichedRoute, routeSummary);
        }

        if (enrichedRoute.length > 0 && routeMetadataChanged) {
          if (teleopMode) {
            saveTodaySimulationRoute(enrichedRoute);
            setSimulationPath(enrichedRoute);
          } else {
            saveTodayRoute(enrichedRoute);
            setTodayPath(enrichedRoute);
          }
        }

        setRouteLoad({
          city: currentCity,
          currentCityPm25: Number(currentCityPm25.toFixed(1)),
          currentCityExposure,
          avgPm25: stats.avgPm25,
          routeMinutes: stats.minutes,
          exposureLoad: stats.exposureLoad,
          routeDistanceKm: stats.km,
          segmentCount: stats.segments,
          sampleCount: stats.hits,
          pm25SampleCount: pm25Samples.length,
          cityPath: stats.cityPath,
          mode: routeMode,
          routeSource: teleopMode
            ? roadRoute?.source || "Simulation"
            : routeSummary.routeSource,
          routeKind: teleopMode ? "simulation" : "gps",
        });
      } catch {
        if (!alive) return;
        setRouteLoad(null);
      } finally {
        if (alive) setRouteLoadLoading(false);
      }
    }

    const timer = setTimeout(calculateRouteExposureLoad, 500);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [activePath, currentCity, pm25SampleCount, roadRoute, routeMode, syncCloudRoute, teleopMode]);

  function handleCitySelect(city) {
    const coords = CITY_COORDS[city];
    if (!coords) return;

    setCurrentCity(city);
    setLocation(coords);

    if (teleopMode) {
      setTeleopPos(coords);
      const result = appendSimulationPoint(coords.latitude, coords.longitude, { city });
      setSimulationPath(result.route);
      setSimulationDistance(result.distance);
    }

    closeSearch();
    setRecenterSignal((value) => value + 1);
  }

  function handleTeleopMove(latitude, longitude) {
    const next = { latitude, longitude };
    const city = getNearestCity(latitude, longitude);

    setTeleopPos(next);
    setCurrentCity(city);

    const result = appendSimulationPoint(latitude, longitude, { city });
    setSimulationPath(result.route);
    setSimulationDistance(result.distance);
  }

  function toggleTeleop() {
    if (!teleopMode) {
      setTeleopPos(location);
      setTeleopMode(true);
      return;
    }

    setTeleopMode(false);
    setTeleopPos(null);
    setRecenterSignal((value) => value + 1);
  }

  function recenter() {
    if (teleopMode) {
      const target = teleopPos || location;
      setRecenterTarget(target);
      setRecenterSignal((value) => value + 1);
      return;
    }

    if (!navigator.geolocation) {
      setRecenterTarget(location);
      setRecenterSignal((value) => value + 1);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(nextLocation);
        setCurrentCity(
          getNearestCity(nextLocation.latitude, nextLocation.longitude)
        );

        // Important: pass the fresh GPS directly to the map.
        setRecenterTarget(nextLocation);
        setRecenterSignal((value) => value + 1);
      },
      (error) => {
        console.warn("GPS recenter failed:", error);

        // Fall back to last known app location.
        setRecenterTarget(location);
        setRecenterSignal((value) => value + 1);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  function resetTodayRoute() {
    if (teleopMode) {
      clearTodaySimulationRoute();
      setSimulationPath([]);
      setSimulationDistance(0);
      setRoadRoute(null);
      setRouteLoad(null);
      return;
    }

    clearTodayRoute();
    if (firebaseReady && user?.uid) {
      deleteUserRoute(user.uid, todayRouteId).catch((error) => {
        console.warn("Unable to delete cloud route:", error);
      });
    }

    setTodayPath([]);
    setDistance(0);
    setRouteLoad(null);
  }

  function closeSearch() {
    setIsSearching(false);
    setSearch("");
  }

  const displayedDistance = routeLoad?.routeDistanceKm ?? activeDistance;
  const routeSourceLabel = roadRoutingLoading
    ? "routing road path"
    : teleopMode
      ? routeLoad?.routeSource || "Simulation"
      : routeLoad?.routeSource || "GPS samples";
  const routeSourceDisplay = routeSourceName(routeSourceLabel, isChinese);
  const routeCityPath = routeLoad?.cityPath?.length
    ? routeLoad.cityPath
    : cityPathFromPoints(activePath);
  const routeCityPathVisible = visibleCityPath(routeCityPath, routePathOpen);
  const routeCityPathHiddenCount = Math.max(0, routeCityPath.length - 4);
  const routeSampleLabel = routeLoad?.pm25SampleCount > 0
    ? t("PM samples", "PM 樣本")
    : teleopMode
      ? t("moves", "次移動")
      : t("GPS points", "GPS 點");

  return (
    <main className="app-root home-root">
      <div className="phone-frame-map">
        <TaiwanMap
          location={location}
          teleopMode={teleopMode}
          teleopPos={teleopPos}
          todayPath={activePath}
          routePath={roadRoute?.coords || []}
          onTeleopMove={handleTeleopMove}
          recenterSignal={recenterSignal}
          recenterTarget={recenterTarget}
        />

        <div className="home-search-wrap">
          <div className="map-search-compact">
            <Search size={20} strokeWidth={3} className="home-search-icon" />

            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsSearching(true);
              }}
              onFocus={() => setIsSearching(true)}
              placeholder={t("Search city...", "搜尋城市...")}
              className="home-search-input"
            />

            {search.length > 0 && (
              <button type="button" onClick={closeSearch} className="search-clear-button">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {isSearching && (
          <button
            type="button"
            aria-label={t("Close search", "關閉搜尋")}
            onClick={closeSearch}
            className="home-search-dismiss"
          />
        )}

        {isSearching && (
          <div className="search-panel-compact">
            <div className="search-panel-header">
              <div className="region-filter-list">
                {REGION_NAMES.map((region) => (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={[
                      "region-filter-button",
                      selectedRegion === region ? "region-filter-button-active" : "",
                    ].join(" ")}
                  >
                    {regionName(region, isChinese)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={closeSearch}
                className="search-panel-close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="city-results">
              {filteredCities.map((city) => (
                <button
                  key={city}
                  onClick={() => handleCitySelect(city)}
                  className="city-result-button"
                >
                  <MapPin size={18} className="city-result-icon" />
                  <span className="city-result-name">{cityName(city, isChinese)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {teleopMode && !isSearching && (
          <div
            className={[
              "simulation-help-card",
              !simulationHelpOpen ? "simulation-help-card-collapsed" : "",
            ].join(" ")}
          >
            <button
              type="button"
              className="simulation-help-header"
              onClick={() => setSimulationHelpOpen((value) => !value)}
              aria-expanded={simulationHelpOpen}
            >
              <span className="simulation-pill">{t("Simulation", "模擬")}</span>
              <span className="simulation-compact-copy">
                {t("Drag marker, route by road.", "拖曳標記，道路規劃。")}
              </span>
              {simulationHelpOpen ? (
                <ChevronUp size={17} strokeWidth={3} />
              ) : (
                <ChevronDown size={17} strokeWidth={3} />
              )}
            </button>

            {simulationHelpOpen && (
              <>
                <p className="simulation-title">
                  {t("Drag the green marker to simulate movement.", "拖曳綠色標記來模擬移動。")}
                </p>
                <p className="simulation-copy">
                  {t(
                    "Each marker move adds a simulation point. Home routes between points by road when available, then averages PM2.5 across the route cities.",
                    "每次移動標記都會新增模擬點。首頁會盡量用道路連接各點，再平均路線城市的 PM2.5。"
                  )}
                </p>
              </>
            )}
          </div>
        )}

        <div className="home-bottom-dock">
          <div className="map-control-stack">
            <button
              onClick={toggleTeleop}
              title={teleopMode ? t("Exit simulation mode", "結束模擬模式") : t("Start simulation mode", "開始模擬模式")}
              className={[
                "floating-control",
                teleopMode ? "floating-control-active" : "",
              ].join(" ")}
            >
              <Gamepad2 size={23} strokeWidth={3} />
            </button>

            <button
              onClick={recenter}
              title={t("Recenter map", "重新置中地圖")}
              className="floating-control"
            >
              <LocateFixed size={24} strokeWidth={3} />
            </button>
          </div>

          <div
            className={[
              "home-bottom-sheet",
              !homeInfoOpen ? "home-bottom-sheet-collapsed" : "",
            ].join(" ")}
          >
            <button
              type="button"
              className="home-info-toggle"
              onClick={() => setHomeInfoOpen((value) => !value)}
              aria-expanded={homeInfoOpen}
            >
              <div className="home-info-toggle-copy">
                <p className="home-bottom-label">
                  {homeInfoOpen ? t("Live Route", "即時路線") : t("Current City", "目前城市")}
                </p>
                <p className="home-info-toggle-title">
                  {cityName(currentCity, isChinese)}
                </p>
                <p className="home-info-toggle-meta">
                  {transportName(routeMode, isChinese)} · {Number(displayedDistance || 0).toFixed(2)} KM · {routeLoadLoading ? "..." : routeLoad?.exposureLoad ?? 0} µg/m³
                </p>
              </div>
              <span className="home-info-toggle-icon">
                {homeInfoOpen ? (
                  <ChevronDown size={18} strokeWidth={3} />
                ) : (
                  <ChevronUp size={18} strokeWidth={3} />
                )}
              </span>
            </button>

            {homeInfoOpen && (
              <>
              <div className="home-bottom-divider home-bottom-divider-after-toggle" />

              <div className="home-bottom-grid">
                <div className="home-bottom-cell">
                  <p className="home-bottom-label">{t("Current City", "目前城市")}</p>
                  <p className="home-bottom-value">{cityName(currentCity, isChinese)}</p>
                  <p className="home-bottom-sub">
                    PM2.5 {routeLoad?.currentCityPm25 ?? 0} µg/m³
                  </p>
                </div>

                <div className="home-bottom-cell">
                  <p className="home-bottom-label">{t("City PM2.5", "城市 PM2.5")}</p>
                  <p className="home-bottom-value-strong">
                    {routeLoadLoading ? "..." : routeLoad?.currentCityExposure ?? 0}
                    <span className="home-bottom-unit">µg/m³</span>
                  </p>
                  <p className="home-bottom-sub">{t("local estimate", "本地估算")}</p>
                </div>
              </div>

              <div className="home-bottom-divider" />

              <div className="home-route-mode-row" aria-label={t("Route mode", "路線模式")}>
                {HOME_ROUTE_MODES.map(({ id, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRouteMode(id)}
                    className={[
                      "home-route-mode-button",
                      routeMode === id ? "home-route-mode-button-active" : "",
                    ].join(" ")}
                    title={transportName(id, isChinese)}
                  >
                    <Icon size={15} strokeWidth={3} />
                    <span>{transportName(id, isChinese)}</span>
                  </button>
                ))}
              </div>

              <div className="home-bottom-divider" />

              <div className="home-route-chain">
                <div className="home-route-chain-head">
                  <p className="home-bottom-label">
                    {teleopMode ? t("Simulation Route", "模擬路線") : t("GPS Route", "GPS 路線")}
                  </p>

                  {routeCityPath.length > 5 && (
                    <button
                      type="button"
                      className="home-route-chain-toggle"
                      onClick={() => setRoutePathOpen((value) => !value)}
                    >
                      {routePathOpen
                        ? t("Collapse", "收合")
                        : `${t("Show all", "全部")} +${routeCityPathHiddenCount}`}
                    </button>
                  )}
                </div>

                {routeCityPath.length > 0 ? (
                  <div className="home-route-chain-list">
                    {routeCityPathVisible.map((city, index) => (
                      <span
                        key={`${city}-${index}`}
                        className="home-route-chain-item"
                      >
                        {index > 0 && <span className="home-route-chain-arrow">→</span>}
                        {city === "__more__" ? (
                          <span className="home-route-chain-more">
                            +{routeCityPathHiddenCount}
                          </span>
                        ) : (
                          <span className="home-route-chain-city">
                            {cityName(city, isChinese)}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="home-route-chain-empty">
                    {teleopMode
                      ? t("Drag or search cities to build a simulation route.", "拖曳或搜尋城市來建立模擬路線。")
                      : t("Move with your phone to build the real GPS route.", "帶著手機移動後會建立真實 GPS 路線。")}
                  </p>
                )}
              </div>

              <div className="home-bottom-divider" />

              <div className="home-bottom-grid">
                <div className="home-bottom-cell">
                  <p className="home-bottom-label">{t("Road Distance", "道路距離")}</p>
                  <p className="home-bottom-value-strong">
                    {Number(displayedDistance || 0).toFixed(2)}
                    <span className="home-bottom-unit">KM</span>
                  </p>
                </div>

                <div className="home-bottom-cell">
                  <p className="home-bottom-label">{t("Route PM Avg", "路線 PM 平均")}</p>
                  <p className="home-bottom-value-strong">
                    {routeLoadLoading ? "..." : routeLoad?.exposureLoad ?? 0}
                    <span className="home-bottom-unit">µg/m³</span>
                  </p>
                </div>
              </div>

              <div className="home-bottom-footer">
                <p className="home-bottom-note">
                  {transportName(routeMode, isChinese)} · {routeSourceDisplay} · {routeLoad?.routeMinutes ?? 0} {t("min", "分鐘")} · {routeLoad?.sampleCount ?? activePath.length} {routeSampleLabel}
                </p>

                <button
                  type="button"
                  onClick={resetTodayRoute}
                  title={t("Reset today's route", "重設今日路線")}
                  className="home-bottom-reset"
                >
                  <RotateCcw size={11} strokeWidth={3} />
                  {t("Reset", "重設")}
                </button>

              </div>
              </>
            )}

            {!homeInfoOpen && (
              <button
                type="button"
                onClick={resetTodayRoute}
                title={t("Reset today's route", "重設今日路線")}
                className="home-bottom-reset"
              >
                <RotateCcw size={11} strokeWidth={3} />
                {t("Reset", "重設")}
              </button>
            )}

          </div>
        </div>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
