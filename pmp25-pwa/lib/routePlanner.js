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

    let durationMin = route.duration / 60;

    if (mode === "bike") {
      durationMin = (distanceKm / 16) * 60;
    }

    if (mode === "walk") {
      durationMin = (distanceKm / 5) * 60;
    }

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

export function estimateExposureLoad(pm25, minutes, mode = "car") {
  const multiplier = mode === "walk" ? 1.35 : mode === "bike" ? 1.6 : 1;
  return Number((pm25 * (minutes / 60) * multiplier).toFixed(1));
}
