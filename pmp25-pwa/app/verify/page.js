"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogOut, MailCheck, RefreshCw, Send } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { isAppVerifiedUser } from "@/lib/authStatus";

export default function VerifyPage() {
  const router = useRouter();
  const { t } = useAppPreferences();
  const {
    user,
    authReady,
    firebaseReady,
    logout,
    reloadCurrentUser,
    resendVerification,
  } = useAuth();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const verified = isAppVerifiedUser(user);

  useEffect(() => {
    if (!authReady || !user || verified) return undefined;

    let cancelled = false;

    async function refreshVerification() {
      try {
        const refreshedUser = await reloadCurrentUser();
        if (!cancelled && isAppVerifiedUser(refreshedUser)) {
          router.replace("/home");
        }
      } catch {
        // The visible refresh button reports errors; silent checks should stay quiet.
      }
    }

    const timer = window.setTimeout(refreshVerification, 800);

    function handleVisibility() {
      if (document.visibilityState === "visible") refreshVerification();
    }

    window.addEventListener("focus", refreshVerification);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshVerification);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [authReady, reloadCurrentUser, router, user, verified]);

  useEffect(() => {
    if (authReady && verified) router.replace("/home");
  }, [authReady, router, verified]);

  async function handleResend() {
    setBusy(true);
    setStatus("");

    try {
      await resendVerification();
      setStatus(t("Verification email sent again.", "驗證信已重新送出。"));
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    setBusy(true);
    setStatus("");

    try {
      const refreshedUser = await reloadCurrentUser();
      if (isAppVerifiedUser(refreshedUser)) {
        setStatus(t("Account verified. Opening the app...", "帳號已驗證，正在進入 App..."));
        router.replace("/home");
        return;
      }

      setStatus(t("Still waiting for verification.", "仍在等待驗證完成。"));
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <main className="app-root">
      <div className="phone-frame relative min-h-screen overflow-y-auto">
        <section className="app-page-body">
          <div className="verification-card">
            <div className="verification-icon">
              {verified ? (
                <CheckCircle2 size={36} strokeWidth={2.8} />
              ) : (
                <MailCheck size={36} strokeWidth={2.8} />
              )}
            </div>

            <p className="screen-kicker">
              {t("Account", "帳號")}
            </p>

            <h1 className="app-page-title mt-2">
              {verified ? t("Verified", "已驗證") : t("Verify Account", "驗證帳號")}
            </h1>

            {!firebaseReady && (
              <p className="verification-copy">
                {t(
                  "Firebase is not configured yet. Add your project env values before using account verification.",
                  "尚未設定 Firebase。請先加入專案環境變數才能使用帳號驗證。"
                )}
              </p>
            )}

            {firebaseReady && !authReady && (
              <p className="verification-copy">
                {t("Checking account...", "正在確認帳號...")}
              </p>
            )}

            {firebaseReady && authReady && !user && (
              <>
                <p className="verification-copy">
                  {t("Sign in first to verify your account.", "請先登入以驗證帳號。")}
                </p>
                <Link href="/login" className="settings-button settings-button-primary">
                  {t("Go to Login", "前往登入")}
                </Link>
              </>
            )}

            {firebaseReady && user && (
              <>
                <p className="verification-copy">
                  {verified
                    ? t("Your account is verified and your profile can sync with Firestore.", "帳號已驗證，個人資料可與 Firestore 同步。")
                    : t("Open the verification link from Firebase, then return here and refresh your status. If it did not arrive, send it again and check spam or promotions.", "請打開 Firebase 寄出的驗證連結，再回到此頁重新確認狀態。如果沒有收到，請重新寄送並檢查垃圾信或促銷信件。")}
                </p>

                <div className="verification-email">
                  {user.email}
                </div>

                <div className="verification-actions">
                  {!verified && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={busy}
                      className="settings-button settings-button-violet"
                    >
                      <Send size={18} strokeWidth={2.8} />
                      {t("Resend Email", "重新寄送")}
                    </button>
                  )}

                  {verified ? (
                    <Link href="/home" className="settings-button settings-button-primary">
                      <CheckCircle2 size={18} strokeWidth={2.8} />
                      {t("Continue to App", "進入 App")}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={busy}
                      className="settings-button settings-button-primary"
                    >
                      <RefreshCw size={18} strokeWidth={2.8} />
                      {t("I Verified, Refresh", "我已驗證，重新確認")}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="settings-button settings-button-danger"
                  >
                    <LogOut size={18} strokeWidth={2.8} />
                    {t("Logout", "登出")}
                  </button>
                </div>
              </>
            )}

            {status && (
              <div className="status-callout text-center">
                {status}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
