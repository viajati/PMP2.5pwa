"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { useAuth } from "@/components/AuthProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useAppPreferences();
  const {
    firebaseReady,
    resetPassword,
    confirmResetPassword,
    verifyResetCode,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email") || "";
    const codeParam = params.get("oobCode") || "";

    queueMicrotask(() => {
      setEmail(emailParam);
      setCode(codeParam);
    });

    if (!codeParam) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setCheckingCode(true);
    });

    verifyResetCode(codeParam)
      .then((accountEmail) => {
        if (cancelled) return;
        setVerifiedEmail(accountEmail);
        setEmail(accountEmail);
        setStatus("");
      })
      .catch((error) => {
        if (!cancelled) setStatus(error.message);
      })
      .finally(() => {
        if (!cancelled) setCheckingCode(false);
      });

    return () => {
      cancelled = true;
    };
  }, [verifyResetCode]);

  async function handleRequestReset(event) {
    event.preventDefault();
    setStatus("");
    setSubmitting(true);

    try {
      if (!firebaseReady) {
        setStatus(t(
          "Firebase is not configured yet. Add the project env values to enable password reset.",
          "尚未設定 Firebase。請加入專案環境變數以啟用密碼重設。"
        ));
        return;
      }

      await resetPassword(email.trim());
      setStatus(t(
        "Password reset email sent. Open the link from your inbox to choose a new password.",
        "密碼重設信已送出。請打開信件中的連結來設定新密碼。"
      ));
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReset(event) {
    event.preventDefault();
    setStatus("");

    if (password.length < 6) {
      setStatus(t("Use at least 6 characters.", "請至少使用 6 個字元。"));
      return;
    }

    if (password !== confirmPassword) {
      setStatus(t("Passwords do not match.", "兩次輸入的密碼不一致。"));
      return;
    }

    setSubmitting(true);

    try {
      await confirmResetPassword(code, password);
      setStatus(t(
        "Password updated. Returning to login...",
        "密碼已更新，正在返回登入頁..."
      ));
      window.setTimeout(() => router.push("/login"), 900);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const hasResetCode = Boolean(code);

  return (
    <main className="app-root">
      <div className="phone-frame relative min-h-screen overflow-y-auto">
        <section className="app-page-body">
          <Link href="/login" className="settings-button settings-button-secondary reset-back-link">
            <ArrowLeft size={18} strokeWidth={2.8} />
            {t("Login", "登入")}
          </Link>

          <div className="verification-card reset-password-card">
            <div className="verification-icon">
              <ShieldCheck size={36} strokeWidth={2.8} />
            </div>

            <p className="screen-kicker">{t("Account", "帳號")}</p>
            <h1 className="app-page-title mt-2">
              {hasResetCode ? t("New Password", "新密碼") : t("Reset Password", "重設密碼")}
            </h1>

            <p className="verification-copy">
              {hasResetCode
                ? t("Choose a new password for your account.", "請為你的帳號設定新密碼。")
                : t("Enter your email and we will send a secure reset link.", "輸入 Email，我們會寄出安全的重設連結。")}
            </p>

            {hasResetCode ? (
              <form className="login-form-stack reset-password-form" onSubmit={handleConfirmReset}>
                <div className="login-status-pill">
                  {checkingCode
                    ? t("Checking reset link...", "正在檢查重設連結...")
                    : verifiedEmail || email}
                </div>

                <div className="login-field">
                  <Lock className="login-field-icon" size={20} strokeWidth={2.8} />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="login-field-input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t("New password", "新密碼")}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-field-action"
                    onClick={() => setShowPassword((value) => !value)}
                    title={showPassword ? t("Hide password", "隱藏密碼") : t("Show password", "顯示密碼")}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="login-field">
                  <Lock className="login-field-icon" size={20} strokeWidth={2.8} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    className="login-field-input"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={t("Confirm password", "確認密碼")}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-field-action"
                    onClick={() => setShowConfirm((value) => !value)}
                    title={showConfirm ? t("Hide password", "隱藏密碼") : t("Show password", "顯示密碼")}
                  >
                    {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <button className="login-submit" disabled={submitting || checkingCode}>
                  {submitting ? t("Please wait", "請稍候") : t("Update Password", "更新密碼")}
                </button>
              </form>
            ) : (
              <form className="login-form-stack reset-password-form" onSubmit={handleRequestReset}>
                <div className="login-field">
                  <Mail className="login-field-icon" size={20} strokeWidth={2.8} />
                  <input
                    type="email"
                    className="login-field-input"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("Email Address", "Email 地址")}
                    autoComplete="email"
                    required
                  />
                </div>

                <button className="login-submit" disabled={submitting}>
                  {submitting ? t("Please wait", "請稍候") : t("Send Reset Link", "寄送重設連結")}
                </button>
              </form>
            )}

            {status && (
              <div className="login-auth-status reset-password-status">
                {status}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
