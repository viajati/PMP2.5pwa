export async function fetchRoute(start, end, mode = "car") {
  if (!start || !end) return null;

  // Public OSRM demo is most reliable with driving.
  // We use it for route geometry, then estimate bike/walk time separately.
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.longitude},${start.latitude};${end.longitude},${end.latitude}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error(data.message || "No route returned");
    }

    const route = data.routes[0];
    const distanceKm = route.distance / 1000;
    const durationMin = routeDurationForMode(mode, distanceKm, route.duration / 60);

    return {
      coords: route.geometry.coordinates.map((point) => ({
        latitude: point[1],
        longitude: point[0],
      })),
      distance: distanceKm,
      duration: durationMin,
      source: "OSRM",
    };
  } catch (error) {
    console.warn("OSRM route fetch failed:", error);
    return null;
  }
}

export function routeSpeedKmH(mode = "car") {
  if (mode === "walk") return 5;
  if (mode === "bike") return 16;
  return null;
}

export function routeDurationForMode(mode = "car", distanceKm = 0, drivingMinutes = 0) {
  const speed = routeSpeedKmH(mode);
  if (!speed) return drivingMinutes || distanceKm * 1.4;
  return (distanceKm / speed) * 60;
}

export function exposureMultiplierForMode(mode = "car") {
  if (mode === "walk") return 1.35;
  if (mode === "bike") return 1.6;
  return 1;
}

export function estimateExposureLoad(pm25, minutes, mode = "car") {
  return Number(
    (pm25 * (minutes / 60) * exposureMultiplierForMode(mode)).toFixed(1)
  );
}
