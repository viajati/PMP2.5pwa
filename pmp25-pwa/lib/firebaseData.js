import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  assertFirebaseConfigured,
  firestoreDb,
} from "@/lib/firebaseClient";
import { isAppVerifiedUser } from "@/lib/authStatus";

function db() {
  assertFirebaseConfigured();
  return firestoreDb;
}

function settingsDoc(uid, id) {
  return doc(db(), "users", uid, "settings", id);
}

export function accountDoc(uid) {
  return doc(db(), "users", uid);
}

export function routeDoc(uid, routeId) {
  return doc(db(), "users", uid, "routes", routeId);
}

export async function upsertUserAccount(user) {
  if (!user) return;

  const ref = accountDoc(user.uid);
  const snap = await getDoc(ref);

  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      emailVerified: isAppVerifiedUser(user),
      providerIds: user.providerData?.map((provider) => provider.providerId) || [],
      createdAt: snap.exists() ? snap.data().createdAt || serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function clearUserProfileData(uid) {
  await Promise.all([
    deleteDoc(accountDoc(uid)),
    deleteDoc(settingsDoc(uid, "preferences")),
    deleteDoc(settingsDoc(uid, "healthProfile")),
  ]);

  const routes = await getDocs(collection(db(), "users", uid, "routes"));
  await Promise.all(routes.docs.map((route) => deleteDoc(route.ref)));
}

export function subscribeUserAccount(uid, onNext, onError) {
  return onSnapshot(
    accountDoc(uid),
    (snap) => onNext(snap.exists() ? snap.data() : null),
    onError
  );
}

export async function saveUserPreferences(uid, prefs) {
  await setDoc(
    settingsDoc(uid, "preferences"),
    {
      ...prefs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeUserPreferences(uid, onNext, onError) {
  return onSnapshot(
    settingsDoc(uid, "preferences"),
    (snap) => onNext(snap.exists() ? snap.data() : null),
    onError
  );
}

export async function saveHealthProfile(uid, profile) {
  await setDoc(
    settingsDoc(uid, "healthProfile"),
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeHealthProfile(uid, onNext, onError) {
  return onSnapshot(
    settingsDoc(uid, "healthProfile"),
    (snap) => onNext(snap.exists() ? snap.data() : null),
    onError
  );
}

export async function saveUserRoute(uid, routeId, points, summary = {}) {
  const payload = {
    routeId,
    summary,
    updatedAt: serverTimestamp(),
  };

  if (Array.isArray(points) && points.length > 0) {
    payload.points = points;
  }

  await setDoc(
    routeDoc(uid, routeId),
    payload,
    { merge: true }
  );
}

export async function deleteUserRoute(uid, routeId) {
  await deleteDoc(routeDoc(uid, routeId));
}

export function subscribeUserRoute(uid, routeId, onNext, onError) {
  return onSnapshot(
    routeDoc(uid, routeId),
    (snap) => onNext(snap.exists() ? snap.data() : null),
    onError
  );
}

export async function loadUserRoutes(uid, routeIds) {
  const entries = await Promise.all(
    routeIds.map(async (routeId) => {
      const snap = await getDoc(routeDoc(uid, routeId));
      return [routeId, snap.exists() ? snap.data() : null];
    })
  );

  return entries.reduce((routes, [routeId, route]) => {
    if (route?.points?.length) routes[routeId] = route.points;
    return routes;
  }, {});
}

export async function loadUserRouteHistory(uid, routeIds) {
  const entries = await Promise.all(
    routeIds.map(async (routeId) => {
      const snap = await getDoc(routeDoc(uid, routeId));
      return [routeId, snap.exists() ? snap.data() : null];
    })
  );

  return entries.reduce((routes, [routeId, route]) => {
    if (route?.points?.length || route?.summary?.pm25Samples?.length) {
      routes[routeId] = {
        points: route.points || [],
        summary: route.summary || null,
      };
    }

    return routes;
  }, {});
}

export async function clearUserRoutes(uid) {
  const snap = await getDocs(collection(db(), "users", uid, "routes"));
  await Promise.all(snap.docs.map((route) => deleteDoc(route.ref)));
}
