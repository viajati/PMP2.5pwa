import Link from "next/link";

export const metadata = {
  title: "Data Deletion",
  description: "Data deletion instructions for PMP2.5.",
};

export default function DataDeletionPage() {
  return (
    <main className="app-root">
      <div className="phone-frame relative min-h-screen overflow-y-auto legal-frame">
        <section className="legal-page">
          <p className="screen-kicker">PMP2.5</p>
          <h1 className="app-page-title mt-2">Data Deletion Instructions</h1>
          <p className="legal-updated">Last updated: May 29, 2026</p>

          <div className="legal-card">
            <p>
              These instructions explain how to remove data connected to your
              PMP2.5 account, including accounts created through Facebook Login.
            </p>
          </div>

          <div className="legal-section">
            <h2>Remove PMP2.5 From Facebook</h2>
            <ol>
              <li>Open Facebook Settings and privacy.</li>
              <li>Go to Settings, then Apps and websites.</li>
              <li>Select PMP2.5.</li>
              <li>Choose Remove to disconnect the app from your Facebook account.</li>
            </ol>
          </div>

          <div className="legal-section">
            <h2>Delete App Account Data</h2>
            <p>
              To request deletion of cloud account data, send a request from the
              email address connected to your PMP2.5 account to the app owner
              contact email configured in the Meta/Firebase app dashboard.
            </p>
            <p>
              Include the subject line “PMP2.5 Data Deletion Request” and the
              email address or sign-in provider used for the account. After the
              request is verified, account-linked profile, preference, route, and
              exposure records will be deleted unless retention is required by
              law or necessary for security.
            </p>
          </div>

          <div className="legal-section">
            <h2>Delete Local Browser Data</h2>
            <p>
              Open PMP2.5, go to Setup, and use Clear Cache to remove local route
              and history data stored in the browser. You can also clear all site
              data for PMP2.5 from your browser settings.
            </p>
          </div>

          <div className="legal-section">
            <h2>Deletion Timing</h2>
            <p>
              Verified deletion requests are processed as soon as reasonably
              possible. Backup or security logs may take additional time to age
              out of provider systems.
            </p>
          </div>

          <p className="legal-note">
            This page is provided as the User Data Deletion Instructions URL for
            Meta/Facebook Login.
          </p>

          <div className="legal-link-row">
            <Link href="/privacy" className="legal-back-link">
              Privacy Policy
            </Link>
            <Link href="/login" className="legal-back-link">
              Back to Login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
