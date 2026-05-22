# PMP2.5 Taiwan PWA

PMP2.5 Taiwan is a mobile-first Progressive Web App for understanding personal PM2.5 exposure in Taiwan. It combines live air quality, weather context, route planning, GPS-based movement history, account sync, bilingual UI, and a health profile so users can see not only the air quality around them, but also how much exposure they accumulate while moving.

The app is built as a Next.js web app and designed to feel like a native phone interface inside the browser.

## Screens

| Login | Home map | Home route card |
| --- | --- | --- |
| ![Login](docs/screenshots/01-login.jpg) | ![Home collapsed](docs/screenshots/03-home-collapsed.jpg) | ![Home expanded](docs/screenshots/04-home-expanded.jpg) |

| Records | Summary | Setup |
| --- | --- | --- |
| ![Records](docs/screenshots/05-records-live.jpg) | ![Summary](docs/screenshots/08-summary.jpg) | ![Setup](docs/screenshots/09-setup.jpg) |

| Reset password | Health profile |
| --- | --- |
| ![Reset password](docs/screenshots/02-reset-password.jpg) | ![Profile](docs/screenshots/10-profile.jpg) |

## Core Idea

Most air quality apps show a city-level number. PMP2.5 adds a personal layer:

- Where am I now?
- What is the PM2.5 near me?
- How far did I actually travel today?
- How long was I exposed?
- What route did I move through?
- How does my travel mode affect exposure?
- How does my health/activity profile change how I should interpret the risk?

The app separates real movement from simulation. Real GPS tracking writes to the history log. Game/simulation mode is only for trying route scenarios on the Home map and does not pollute the real route history.

## Technology Stack

- Next.js 16 App Router for routing, pages, metadata, and production builds.
- React 19 for client-side UI state and interactive screens.
- Firebase Authentication for email/password login, email verification, Google login, and password reset.
- Cloud Firestore for user profile, preferences, health profile, and daily route history sync.
- Leaflet and React Leaflet for the Home map and route preview maps.
- Open-Meteo Air Quality API for PM2.5, PM10, carbon monoxide, and forecast values.
- Open-Meteo Forecast API for weather, temperature, humidity, wind, and weather codes.
- OSRM public routing API for road route geometry and road distance estimates.
- Lucide React for the icon system.
- Tailwind CSS v4 plus a unified global theme in `app/globals.css`.

## Main User Flow

1. A user opens the app and lands on Login.
2. They choose language and light/dark mode before signing in.
3. They log in with verified email/password or Google.
4. Home opens with a GPS-aware Taiwan map.
5. The app records real GPS samples in the background.
6. Home estimates route exposure from PM2.5, time, transport mode, and road route where available.
7. Summary turns the real GPS route into a seven-day history log.
8. Records provides live city air quality, route planner calculations, and forecast context.
9. Setup and Profile let the user customize identity, avatar, language, theme, alerts, and health factors.

## Authentication

The app requires a verified account before entering the protected screens.

Login supports:

- Email and password login.
- Email and password registration.
- Firebase email verification.
- Google login.
- Password visibility toggle with an eye button.
- Forgot password flow through `/reset-password`.
- Password reset links using Firebase `oobCode`.
- Facebook button placeholder, kept disabled until a Facebook app ID/secret is configured.

Protected routes are handled by `components/AuthGate.jsx`. Public routes are:

- `/login`
- `/verify`
- `/reset-password`

## Home

Home is the live movement and exposure screen.

Main controls:

- Search city: finds and jumps to Taiwan cities.
- Gamepad button: turns simulation mode on/off.
- Recenter button: returns to the current GPS location, or the simulation marker when simulation is active.
- Collapsible route card: expands or collapses route details.
- Transport buttons: Car, Bike, Walk.
- Reset button: resets the active route. In GPS mode it clears today's real GPS route. In simulation mode it clears only the simulated route.
- Info button: opens the route load formula.
- Bottom navigation: Home, Records, Summary, Setup.

Real GPS behavior:

- Real movement uses `navigator.geolocation.watchPosition`.
- GPS points are stored under the real route storage namespace.
- Real GPS tracking continues even when simulation mode is active.
- Summary reads only real GPS route points.

Simulation behavior:

- Simulation mode lets the user drag a marker on the map.
- Simulated points are stored separately from real GPS points.
- Simulated routes can still show estimated road distance and exposure on Home.
- Simulation does not write to Summary history.

## Exposure Calculation

The app uses a time-based exposure model:

```text
segment load = PM2.5 x segment hours x transport exposure multiplier
total route load = sum(segment load)
average PM2.5 = time-weighted PM2.5 across route segments
```

Transport multipliers:

- Car: `1.0`
- Walk: `1.35`
- Bike: `1.6`

Distance and duration:

- If road routing is available, Home uses OSRM route geometry between sampled points.
- If OSRM fails, Home falls back to GPS sample-to-sample distance.
- Walking and biking use road geometry but estimate travel time from typical speeds.
- Summary prefers saved road-route summary when available; otherwise it uses GPS timestamps and distance.

## Records

Records has three sections:

- Live: city-level PM2.5, PM10, CO, temperature, humidity, wind, weather state, CAQI-style score, and safety advice.
- Planner: origin, destination, transport mode, route calculation, distance, time, average PM2.5, and exposure load.
- Forecast: daily PM2.5, PM10, and CO prediction derived from hourly air quality forecasts.

Buttons and controls:

- Refresh: reloads live air quality and forecast data.
- Live / Planner / Forecast tabs: switch Records modes.
- Region buttons: filter city list by North, West, South, East.
- City rows: select a city for detailed live weather and air data.
- Planner selects: choose origin and destination.
- Car/Bike/Walk: select transport exposure mode.
- Calculate: fetches a road route and computes exposure load.

## Summary

Summary is the user's personal history log.

It displays:

- Today's exposure load.
- Weekly distance.
- Weekly load.
- Average PM2.5.
- Active days.
- Seven-day history cards.
- Expandable daily details.
- Distance, average, peak, and low PM2.5.
- Time interval breakdown: `00-06`, `06-12`, `12-18`, `18-24`.
- Sampled route path by city.
- Route source and transport mode.

Important: Summary is based on real GPS route history, not Home simulation mode.

## Setup

Setup controls the account and app preferences.

Functions:

- Avatar picker with preset profile icons.
- Username editor.
- Read-only email field.
- Save Profile: syncs display name to Firebase Auth and Firestore.
- Appearance toggle: dark/light mode.
- Chinese Interface toggle: switches app text and city names between English and Traditional Chinese.
- Cloud Sync row: links to account verification/status.
- Pollution Alerts toggle: asks for browser notification permission.
- Edit Health Profile: opens `/profile`.
- Clear History Cache: clears local route/history cache and cloud routes.
- Logout Session: signs out with Firebase Auth.
- Send Test Alert: sends a browser notification test.

## Health Profile

Profile lets the user describe personal sensitivity and activity.

Inputs:

- Avatar preset.
- Age group.
- Health conditions: asthma, dust allergies, air sensitivity, pollen allergies, heart vitality, outdoor worker.
- Activity level.
- Fitness level.

The profile is saved locally and synced to Firestore when the user is signed in.

## Language And Theme

The app stores preferences locally and synchronizes them when possible.

- Dark mode and light mode share the same global theme system.
- Login and Setup both expose language/theme controls.
- Traditional Chinese mode changes interface labels, city names, weather names, risk names, transport names, and date labels.

## Firebase Data Model

```text
users/{uid}
  email
  displayName
  photoURL
  emailVerified
  providerIds

users/{uid}/settings/preferences
  name
  avatar
  darkMode
  chinese
  notifications

users/{uid}/settings/healthProfile
  ageLevel
  conditions
  activityLevel
  fitnessLevel

users/{uid}/routes/{yyyy_m_d}
  points[]
  summary
```

Route points include latitude, longitude, timestamp, city, PM2.5 when enriched, accuracy, and source. Real GPS points use `source: "gps"`. Simulation points use `source: "simulation"` and are not used by Summary.

## Firebase Setup

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Fill in:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_API_KEY` is server-only and must be set in Vercel project environment variables, not exposed as a `NEXT_PUBLIC_` variable. It powers the Records Live AI health suggestion card. If it is missing, the app falls back to local rule-based advice.

In Firebase Console, enable:

- Authentication: Email/Password.
- Authentication: Google.
- Cloud Firestore.
- Authorized domains for localhost and the deployed domain.

Publish `firestore.rules` so each user can read/write only their own `users/{uid}` tree.

Firebase Storage is not required yet because profile pictures are preset avatar choices, not uploaded files.

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful commands:

```bash
npm run lint
npm run build
```

## Project Structure

```text
pmp25-pwa/
  app/
    home/
    login/
    profile/
    records/
    reset-password/
    setup/
    summary/
    verify/
    globals.css
    layout.js
  components/
    AppPreferencesProvider.jsx
    AuthGate.jsx
    AuthProvider.jsx
    AvatarPicker.jsx
    OriginalBottomNav.jsx
    RoutePreviewMap.jsx
    TaiwanMap.jsx
  lib/
    airQuality.js
    authStatus.js
    cities.js
    firebaseClient.js
    firebaseData.js
    i18n.js
    routePlanner.js
    summaryStats.js
    trackStorage.js
    webWeather.js
  docs/screenshots/
  firestore.rules
  firebase.json
```

## Presentation Summary

PMP2.5 Taiwan is a personalized pollution exposure tracker. It combines live Taiwan air-quality data, weather-aware visuals, road-based route estimates, real GPS history, Firebase account sync, and bilingual user preferences. The key design idea is that exposure is not just a city number; it is accumulated through time, route, movement, and transport mode.
