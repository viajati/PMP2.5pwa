"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { isAppVerifiedUser } from "@/lib/authStatus";

const PUBLIC_PATHS = new Set([
  "/login",
  "/verify",
  "/reset-password",
  "/privacy",
  "/data-deletion",
]);

function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname);
}

export default function AuthGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useAppPreferences();
  const { user, authReady, firebaseReady } = useAuth();
  const publicPath = isPublicPath(pathname);
  const verified = isAppVerifiedUser(user);

  useEffect(() => {
    if (!firebaseReady || !authReady) return;

    if (!user && !publicPath) {
      router.replace("/login");
      return;
    }

    if (user && !verified && pathname !== "/verify") {
      router.replace("/verify");
      return;
    }

    if (
      user &&
      verified &&
      (pathname === "/login" || pathname === "/verify")
    ) {
      router.replace("/home");
    }
  }, [authReady, firebaseReady, pathname, publicPath, router, user, verified]);

  if (!firebaseReady) return children;

  if (!authReady) {
    return (
      <main className="app-root">
        <div className="phone-frame relative min-h-screen overflow-y-auto">
          <section className="app-page-body">
            <div className="verification-card">
              <p className="screen-kicker">{t("Account", "帳號")}</p>
              <h1 className="app-page-title mt-2">
                {t("Checking", "確認中")}
              </h1>
              <p className="verification-copy">
                {t("Checking your account status...", "正在確認帳號狀態...")}
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if ((!user && !publicPath) || (user && !verified && pathname !== "/verify")) {
    return null;
  }

  return children;
}
