import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for PMP2.5.",
};

export default function PrivacyPage() {
  return (
    <main className="app-root">
      <div className="phone-frame relative min-h-screen overflow-y-auto legal-frame">
        <section className="legal-page">
          <p className="screen-kicker">PMP2.5</p>
          <h1 className="app-page-title mt-2">Privacy Policy</h1>
          <p className="legal-updated">Last updated: May 29, 2026</p>

          <div className="legal-card">
            <p>
              PMP2.5 is a progressive web app for estimating personal PM2.5
              exposure, viewing Taiwan air-quality information, planning routes,
              and saving profile preferences.
            </p>
          </div>

          <div className="legal-section">
            <h2>Information We Collect</h2>
            <p>
              When you create or sign in to an account, Firebase Authentication
              may provide your user ID, email address, display name, profile
              photo, sign-in provider, and email verification status.
            </p>
            <p>
              The app may save your app preferences, health and activity profile,
              selected avatar, route summaries, GPS route points, and PM2.5
              exposure history to Firebase Firestore for your account.
            </p>
            <p>
              Location is used to estimate your current city, nearby air quality,
              routes, and exposure. Location access is requested by the browser
              and can be disabled in browser or device settings.
            </p>
          </div>

          <div className="legal-section">
            <h2>How We Use Information</h2>
            <p>
              We use account and profile data to personalize exposure guidance,
              keep your settings synced across devices, calculate route and daily
              summaries, and protect user-specific records with Firebase security
              rules.
            </p>
            <p>
              We do not sell personal information. Third-party services used by
              the app may include Firebase, Vercel, Meta/Facebook Login, Google
              Login, public weather and air-quality data providers, map/routing
              providers, and AI services for health-profile-aware suggestions.
            </p>
          </div>

          <div className="legal-section">
            <h2>Data Retention and Deletion</h2>
            <p>
              Account-linked data is kept while your account is active or until
              deletion is requested. Local browser data can be cleared from the
              app settings or by clearing site data in your browser.
            </p>
            <p>
              For deletion instructions, see the{" "}
              <Link href="/data-deletion">Data Deletion page</Link>.
            </p>
          </div>

          <div className="legal-section">
            <h2>Contact</h2>
            <p>
              For privacy or deletion requests, contact the PMP2.5 app owner
              using the contact email configured in the Meta/Firebase app
              dashboard.
            </p>
          </div>

          <Link href="/login" className="legal-back-link">
            Back to Login
          </Link>
        </section>
      </div>
    </main>
  );
}
