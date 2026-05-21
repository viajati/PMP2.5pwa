# Firebase Setup

The app now supports Firebase Auth and Firestore. It still works locally when Firebase is unavailable, but login and cloud sync need the Firebase console setup below.

## Local Env

`pmp25-pwa/.env.local` contains the local Firebase Web config. It is intentionally ignored by Git. Keep `pmp25-pwa/.env.example` as the shareable template.

## Firebase Console

Enable these products:

- Authentication: Email/Password
- Authentication: Google
- Authentication: Facebook later, when you have a Facebook Developer app ID and secret
- Cloud Firestore

Add `localhost` and your deployed domain in Authentication > Settings > Authorized domains.

## Data Model

- `users/{uid}`: Firebase Auth account metadata
- `users/{uid}/settings/preferences`: theme, language, identity, notifications
- `users/{uid}/settings/healthProfile`: health and activity profile
- `users/{uid}/routes/{yyyy_m_d}`: daily route points and exposure summary

Profile picture choices are preset avatar IDs stored in preferences. Firebase Storage is not needed unless custom photo uploads are added later.

## Rules

Deploy `firestore.rules`, or paste it into the Firebase console. It restricts user data to the signed-in user’s own UID.
