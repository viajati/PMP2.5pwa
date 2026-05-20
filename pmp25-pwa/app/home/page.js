"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Gamepad2,
  LocateFixed,
  MapPin,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import OriginalBottomNav from "@/components/OriginalBottomNav";
import {
  CITY_COORDS,
  REGION_NAMES,
  getFilteredCities,
  getNearestCity,
} from "@/lib/cities";
import {
  appendPoint,
  calculateDistanceKm,
  clearTodayRoute,
  getTodayDistance,
  loadTodayRoute,
} from "@/lib/trackStorage";
import { fetchHourlyAirQuality } from "@/lib/airQuality";

const TaiwanMap = dynamic(() => import("@/components/TaiwanMap"), {
  ssr: false,
});

export default function HomePage() {
  const [location, setLocation] = useState({
    latitude: 23.5,
    longitude: 121.0,
  });

  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [isSearching, setIsSearching] = useState(false);

  const [todayPath, setTodayPath] = useState([]);
  const [distance, setDistance] = useState(0);

  const [currentCity, setCurrentCity] = useState("Taiwan");
  const [routeLoad, setRouteLoad] = useState(null);
  const [routeLoadLoading, setRouteLoadLoading] = useState(false);

  const [teleopMode, setTeleopMode] = useState(false);
  const [teleopPos, setTeleopPos] = useState(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [recenterTarget, setRecenterTarget] = useState(null);

  const filteredCities = useMemo(() => {
    return getFilteredCities(search, selectedRegion);
  }, [search, selectedRegion]);

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
    const savedRoute = loadTodayRoute();
    setTodayPath(savedRoute);
    setDistance(getTodayDistance(savedRoute));

    if (!navigator.geolocation) {
      setCurrentCity("Hsinchu City");
      setLocation(CITY_COORDS["Hsinchu City"]);
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

        const result = appendPoint(
          nextLocation.latitude,
          nextLocation.longitude
        );
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
        if (teleopMode) return;

        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(nextLocation);
        setCurrentCity(
          getNearestCity(nextLocation.latitude, nextLocation.longitude)
        );

        const result = appendPoint(
          nextLocation.latitude,
          nextLocation.longitude
        );
        setTodayPath(result.route);
        setDistance(result.distance);
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [teleopMode]);

  useEffect(() => {
    let alive = true;

    async function estimateCityPm25(city) {
      try {
        const rows = await fetchHourlyAirQuality(city);
        const now = Date.now();

        const futureRows = rows.filter((row) => {
          const rowTime = new Date(row.time).getTime();
          return rowTime >= now;
        });

        const nextRows = futureRows.slice(0, 3);
        const avg =
          nextRows.length > 0
            ? nextRows.reduce((sum, row) => sum + row.pm25, 0) /
              nextRows.length
            : rows[0]?.pm25 || 0;

        return Number(avg.toFixed(1));
      } catch {
        return 0;
      }
    }

    async function calculateRouteExposureLoad() {
      if (!CITY_COORDS[currentCity]) {
        setRouteLoad(null);
        return;
      }

      setRouteLoadLoading(true);

      try {
        const uniqueCities = new Set([currentCity]);

        for (let i = 1; i < todayPath.length; i += 1) {
          const point = todayPath[i];
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
        const currentCityExposure = Number(
          (currentCityPm25 * 1 * 1.35).toFixed(1)
        );

        let totalDistanceKm = 0;
        let totalMinutes = 0;
        let totalExposureLoad = 0;
        let weightedPmSum = 0;

        const walkingSpeedKmPerHour = 5;
        const walkingExposureMultiplier = 1.35;

        for (let i = 1; i < todayPath.length; i += 1) {
          const prev = todayPath[i - 1];
          const curr = todayPath[i];

          const segmentKm = calculateDistanceKm(prev, curr);
          const segmentMinutes = (segmentKm / walkingSpeedKmPerHour) * 60;

          const segmentCity = getNearestCity(curr.latitude, curr.longitude);
          const segmentPm25 = cityPmMap[segmentCity] || currentCityPm25;

          const segmentLoad =
            segmentPm25 * (segmentMinutes / 60) * walkingExposureMultiplier;

          totalDistanceKm += segmentKm;
          totalMinutes += segmentMinutes;
          totalExposureLoad += segmentLoad;
          weightedPmSum += segmentPm25 * segmentKm;
        }

        const avgRoutePm25 =
          totalDistanceKm > 0 ? weightedPmSum / totalDistanceKm : 0;

        if (!alive) return;

        setRouteLoad({
          city: currentCity,
          currentCityPm25: Number(currentCityPm25.toFixed(1)),
          currentCityExposure,
          avgPm25: Number(avgRoutePm25.toFixed(1)),
          routeMinutes: Math.round(totalMinutes),
          exposureLoad: Number(totalExposureLoad.toFixed(1)),
          routeDistanceKm: Number(totalDistanceKm.toFixed(2)),
          segmentCount: Math.max(0, todayPath.length - 1),
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
  }, [todayPath, currentCity]);

  function handleCitySelect(city) {
    const coords = CITY_COORDS[city];
    if (!coords) return;

    setCurrentCity(city);
    setLocation(coords);

    if (teleopMode) {
      setTeleopPos(coords);
      const result = appendPoint(coords.latitude, coords.longitude);
      setTodayPath(result.route);
      setDistance(result.distance);
    }

    closeSearch();
    setRecenterSignal((value) => value + 1);
  }

  function handleTeleopMove(latitude, longitude) {
    const next = { latitude, longitude };
    setTeleopPos(next);
    setCurrentCity(getNearestCity(latitude, longitude));

    const result = appendPoint(latitude, longitude);
    setTodayPath(result.route);
    setDistance(result.distance);
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
    clearTodayRoute();
    setTodayPath([]);
    setDistance(0);
    setRouteLoad(null);
  }

  function closeSearch() {
    setIsSearching(false);
    setSearch("");
  }

  return (
    <main className="app-root">
      <div className="phone-frame-map relative">
        <TaiwanMap
          location={location}
          teleopMode={teleopMode}
          teleopPos={teleopPos}
          todayPath={todayPath}
          onTeleopMove={handleTeleopMove}
          recenterSignal={recenterSignal}
          recenterTarget={recenterTarget}
        />

        <div className="home-search-wrap">
          <div className="map-search-compact">
            <Search size={20} strokeWidth={3} className="text-slate-700" />

            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsSearching(true);
              }}
              onFocus={() => setIsSearching(true)}
              placeholder="Search city..."
              className="ml-3 w-full bg-transparent text-[16px] font-black text-slate-700 outline-none placeholder:text-slate-500"
            />

            {search.length > 0 && (
              <button type="button" onClick={closeSearch}>
                <X size={20} className="text-slate-500" />
              </button>
            )}
          </div>
        </div>

        {isSearching && (
          <button
            type="button"
            aria-label="Close search"
            onClick={closeSearch}
            className="absolute inset-0 z-[580] bg-transparent"
          />
        )}

        {isSearching && (
          <div className="search-panel-compact">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="flex gap-2 overflow-x-auto">
                {REGION_NAMES.map((region) => (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={[
                      "rounded-xl px-3 py-2 text-[10px] font-black",
                      selectedRegion === region
                        ? "bg-[#00D2FF] text-white"
                        : "bg-slate-100 text-slate-500",
                    ].join(" ")}
                  >
                    {region}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={closeSearch}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[40vh] overflow-y-auto">
              {filteredCities.map((city) => (
                <button
                  key={city}
                  onClick={() => handleCitySelect(city)}
                  className="flex w-full items-center border-b border-slate-100 px-2 py-4 text-left"
                >
                  <MapPin size={18} className="mr-3 text-[#00D2FF]" />
                  <span className="text-sm font-bold">{city}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {teleopMode && !isSearching && (
          <div className="simulation-help-card">
            <div className="simulation-pill">Simulation Mode</div>
            <p className="mt-3 text-sm font-black leading-5">
              Drag the green marker to simulate movement.
            </p>
            <p className="mt-2 text-xs font-bold leading-5 text-white/62">
              Each marker move adds a route segment. The app estimates exposure
              load across the whole simulated route, not only the final city.
            </p>
          </div>
        )}

        <div className="map-control-stack">
          <button
            onClick={toggleTeleop}
            title={teleopMode ? "Exit simulation mode" : "Start simulation mode"}
            className={[
              "floating-control",
              teleopMode ? "floating-control-active" : "",
            ].join(" ")}
          >
            <Gamepad2 size={23} strokeWidth={3} />
          </button>

          <button
            onClick={recenter}
            title="Recenter map"
            className="floating-control"
          >
            <LocateFixed size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="home-bottom-sheet">
          <div className="home-bottom-grid">
            <div className="home-bottom-cell">
              <p className="home-bottom-label">Current City</p>
              <p className="home-bottom-value">{currentCity}</p>
              <p className="home-bottom-sub">
                PM2.5 {routeLoad?.currentCityPm25 ?? 0} µg/m³
              </p>
            </div>

            <div className="home-bottom-cell">
              <p className="home-bottom-label">1h City Load</p>
              <p className="home-bottom-value-strong">
                {routeLoadLoading ? "..." : routeLoad?.currentCityExposure ?? 0}
                <span className="home-bottom-unit">score</span>
              </p>
              <p className="home-bottom-sub">local estimate</p>
            </div>
          </div>

          <div className="home-bottom-divider" />

          <div className="home-bottom-grid">
            <div className="home-bottom-cell">
              <p className="home-bottom-label">Distance</p>
              <p className="home-bottom-value-strong">
                {distance.toFixed(2)}
                <span className="home-bottom-unit">KM</span>
              </p>
            </div>

            <div className="home-bottom-cell">
              <p className="home-bottom-label">Total Route Load</p>
              <p className="home-bottom-value-strong">
                {routeLoadLoading ? "..." : routeLoad?.exposureLoad ?? 0}
                <span className="home-bottom-unit">score</span>
              </p>
            </div>
          </div>

          <div className="home-bottom-footer mt-2">
            <p className="home-bottom-note">
              Avg PM2.5 {routeLoad?.avgPm25 ?? 0} · {routeLoad?.routeMinutes ?? 0} min · {routeLoad?.segmentCount ?? 0} segments
            </p>

            <button
              type="button"
              onClick={resetTodayRoute}
              title="Reset today's route"
              className="home-bottom-reset"
            >
              <RotateCcw size={11} strokeWidth={3} />
              Reset
            </button>
          </div>
        </div>

        <OriginalBottomNav />
      </div>
    </main>
  );
}
