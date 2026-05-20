
export const CITY_COORDS = {
  "Taipei City": { latitude: 25.033, longitude: 121.5654 },
  "New Taipei City": { latitude: 25.011, longitude: 121.4617 },
  "Taoyuan City": { latitude: 24.9936, longitude: 121.301 },
  "Taichung City": { latitude: 24.1477, longitude: 120.6736 },
  "Tainan City": { latitude: 22.9997, longitude: 120.227 },
  "Kaohsiung City": { latitude: 22.6273, longitude: 120.3014 },
  "Keelung City": { latitude: 25.1276, longitude: 121.7392 },
  "Hsinchu City": { latitude: 24.8138, longitude: 120.9675 },
  "Chiayi City": { latitude: 23.4801, longitude: 120.4491 },
  "Hsinchu County": { latitude: 24.8383, longitude: 121.0177 },
  "Miaoli County": { latitude: 24.5602, longitude: 120.8214 },
  "Changhua County": { latitude: 24.0816, longitude: 120.5385 },
  "Nantou County": { latitude: 23.9037, longitude: 120.6835 },
  "Yunlin County": { latitude: 23.7092, longitude: 120.4313 },
  "Chiayi County": { latitude: 23.4518, longitude: 120.2555 },
  "Pingtung County": { latitude: 22.6715, longitude: 120.487 },
  "Yilan County": { latitude: 24.7554, longitude: 121.7582 },
  "Hualien County": { latitude: 23.9785, longitude: 121.6033 },
  "Taitung County": { latitude: 22.7583, longitude: 121.1444 },
  "Penghu County": { latitude: 23.5711, longitude: 119.58 },
  "Kinmen County": { latitude: 24.4327, longitude: 118.3225 },
  "Lienchiang County": { latitude: 26.1557, longitude: 119.9544 },
};

export const REGIONS = {
  NORTH: [
    "Taipei City",
    "New Taipei City",
    "Keelung City",
    "Taoyuan City",
    "Hsinchu City",
    "Hsinchu County",
  ],
  WEST: [
    "Miaoli County",
    "Taichung City",
    "Changhua County",
    "Nantou County",
    "Yunlin County",
  ],
  SOUTH: [
    "Chiayi City",
    "Chiayi County",
    "Tainan City",
    "Kaohsiung City",
    "Pingtung County",
  ],
  EAST: [
    "Yilan County",
    "Hualien County",
    "Taitung County",
    "Penghu County",
    "Kinmen County",
    "Lienchiang County",
  ],
};

export const REGION_NAMES = ["ALL", "NORTH", "WEST", "SOUTH", "EAST"];

export function getFilteredCities(search, selectedRegion) {
  return Object.keys(CITY_COORDS).filter((city) => {
    const matchesSearch = city.toLowerCase().includes(search.toLowerCase());
    const matchesRegion =
      selectedRegion === "ALL" || REGIONS[selectedRegion]?.includes(city);

    return matchesSearch && matchesRegion;
  });
}

export function getNearestCity(latitude, longitude) {
  let nearestCity = "Hsinchu City";
  let nearestDistance = Number.POSITIVE_INFINITY;

  Object.entries(CITY_COORDS).forEach(([city, coords]) => {
    const distance =
      Math.pow(latitude - coords.latitude, 2) +
      Math.pow(longitude - coords.longitude, 2);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestCity = city;
    }
  });

  return nearestCity;
}