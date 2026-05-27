"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Languages,
  Lock,
  MapPin,
  Mail,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { CITY_COORDS, getNearestCity } from "@/lib/cities";
import { fetchWeatherByCoords } from "@/lib/webWeather";
import { useAppPreferences } from "@/components/AppPreferencesProvider";
import { useAuth } from "@/components/AuthProvider";
import { isFacebookLoginEnabled } from "@/lib/firebaseClient";
import { isAppVerifiedUser } from "@/lib/authStatus";
import { cityName as localizedCityName, localDateString } from "@/lib/i18n";

function getTimeString(date) {
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getDateString(date, chinese) {
  return localDateString(date, chinese);
}

function weatherSceneType(type) {
  if (type === "raining") return "rain";
  if (type === "storm") return "storm";
  if (type === "windy") return "windy";
  if (type === "cloudy") return "cloudy";
  if (type === "partly") return "partly";
  return "sunny";
}

function authenticWeatherText(type, city, chinese = false) {
  const displayCity = localizedCityName(city, chinese);

  if (chinese) {
    if (type === "raining") return `現在 ${displayCity}\n正在下雨。`;
    if (type === "cloudy") return `${displayCity} 的天空\n目前多雲。`;
    if (type === "partly") return `${displayCity} 現在\n晴時多雲。`;
    if (type === "windy") return `${displayCity} 現在\n風很大。`;
    if (type === "storm") return `${displayCity} 有雷陣雨\n注意安全。`;
    return `現在 ${displayCity}\n陽光燦爛。`;
  }

  if (type === "raining") return `It's raining\nin ${displayCity}\nright now.`;
  if (type === "cloudy") return `The sky is\ncloudy in ${displayCity}.`;
  if (type === "partly") return `It's partly\ncloudy in ${displayCity}.`;
  if (type === "windy") return `It's quite\nwindy in ${displayCity}.`;
  if (type === "storm") return `Thunderstorms\nin ${displayCity}\nStay safe.`;
  return `It's beautifully\nsunny in ${displayCity}.`;
}

export default function LoginPage() {
  const router = useRouter();
  const { prefs, updatePrefs, t } = useAppPreferences();
  const {
    user,
    authReady,
    firebaseReady,
    authError,
    loginWithEmail,
    registerWithEmail,
    loginWithProvider,
  } = useAuth();
  const isChinese = prefs.chinese;
  const [isLogin, setIsLogin] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [cityName, setCityName] = useState("Hsinchu City");
  const [weatherType, setWeatherType] = useState("sunny");

  useEffect(() => {
    const firstTick = window.setTimeout(() => {
      setMounted(true);
      setCurrentTime(new Date());
    }, 0);

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.clearTimeout(firstTick);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    async function loadWeather(latitude, longitude, city) {
      try {
        const weather = await fetchWeatherByCoords(latitude, longitude);
        setCityName(city);
        setWeatherType(weather.type);
      } catch {
        setCityName(city);
        setWeatherType("sunny");
      }
    }

    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get("city");

    if (cityParam && CITY_COORDS[cityParam]) {
      const coords = CITY_COORDS[cityParam];
      loadWeather(coords.latitude, coords.longitude, cityParam);
      return;
    }

    if (!navigator.geolocation) {
      const fallback = CITY_COORDS["Hsinchu City"];
      loadWeather(fallback.latitude, fallback.longitude, "Hsinchu City");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const nearestCity = getNearestCity(latitude, longitude);
        loadWeather(latitude, longitude, nearestCity);
      },
      () => {
        const fallback = CITY_COORDS["Hsinchu City"];
        loadWeather(fallback.latitude, fallback.longitude, "Hsinchu City");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      }
    );
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    if (user.email && !isAppVerifiedUser(user)) {
      router.push("/verify");
      return;
    }

    router.push("/home");
  }, [authReady, router, user]);

  const displayCityName = localizedCityName(cityName, isChinese);
  const weatherLines = authenticWeatherText(weatherType, cityName, isChinese).split("\n");
  const weatherTime =
    currentTime && (currentTime.getHours() >= 18 || currentTime.getHours() < 6)
      ? "night"
      : "day";
  const weatherSceneClass = `login-weather-scene records2-weather-${weatherSceneType(weatherType)}-${weatherTime}`;

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setStatus("");
    setSubmitting(true);

    try {
      if (!firebaseReady) {
        setStatus(t(
          "Firebase is not configured yet. Add the project env values to enable login.",
          "尚未設定 Firebase。請加入專案環境變數以啟用登入。"
        ));
        return;
      }

      const result = isLogin
        ? await loginWithEmail(email.trim(), password)
        : await registerWithEmail(email.trim(), password, displayName.trim());

      if (!isLogin) {
        updatePrefs({ name: displayName.trim() });
      }

      if (!isLogin) {
        router.push("/verify");
        return;
      }

      if (result.user && !isAppVerifiedUser(result.user)) {
        router.push("/verify");
        return;
      }

      router.push("/home");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSocialLogin(provider) {
    setStatus("");
    setSubmitting(true);

    try {
      if (provider === "facebook" && !isFacebookLoginEnabled) {
        setStatus(t(
          "Facebook login is planned, but it is not enabled yet.",
          "Facebook 登入已預留，但尚未啟用。"
        ));
        return;
      }

      if (!firebaseReady) {
        setStatus(t(
          "Firebase is not configured yet. Add the project env values to enable provider login.",
          "尚未設定 Firebase。請加入專案環境變數以啟用社群登入。"
        ));
        return;
      }

      const result = await loginWithProvider(provider, isChinese ? "zh-TW" : "en");

      if (result?.redirecting) {
        setStatus(t(
          "Opening secure sign-in in this tab...",
          "正在此分頁開啟安全登入..."
        ));
        return;
      }

      if (result?.user && !isAppVerifiedUser(result.user)) {
        router.push("/verify");
        return;
      }

      router.push("/home");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-root">
      <div className="login-frame">
        <div className={weatherSceneClass} />
        <div className="login-content">
          <section className="login-hero">
            <div className="login-preference-bar">
              <button
                type="button"
                onClick={() => updatePrefs({ chinese: !prefs.chinese })}
                className="login-preference-button"
                title={isChinese ? "Switch to English" : "切換繁體中文"}
              >
                <Languages size={16} strokeWidth={2.8} />
                {isChinese ? "中文" : "EN"}
              </button>

              <button
                type="button"
                onClick={() => updatePrefs({ darkMode: !prefs.darkMode })}
                className="login-preference-button"
                title={prefs.darkMode ? t("Switch to light mode", "切換淺色模式") : t("Switch to dark mode", "切換深色模式")}
              >
                {prefs.darkMode ? (
                  <Moon size={16} strokeWidth={2.8} />
                ) : (
                  <Sun size={16} strokeWidth={2.8} />
                )}
                {prefs.darkMode ? t("Dark", "深色") : t("Light", "淺色")}
              </button>
            </div>

            <h1 className="login-headline">
              {weatherLines.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </h1>

            <div className="login-rule" />

            <div className="login-time-row">
              <div>
                <p className="login-time">
                  {mounted && currentTime ? getTimeString(currentTime) : "--:--:--"}
                </p>
                <p className="login-date">
                  {mounted && currentTime ? getDateString(currentTime, isChinese) : ""}
                </p>
              </div>

              <div className="login-location-pill">
                <MapPin size={14} strokeWidth={3} />
                <span>{displayCityName}</span>
              </div>
            </div>
          </section>

          <section className="login-sheet">
            <form className="login-form-stack" onSubmit={handleAuthSubmit}>
              <h2 className="login-title">
                {isLogin ? t("Log In", "登入") : t("Sign Up", "註冊")}
              </h2>

              {user && (
                <div className="login-status-pill">
                  {t("Signed in as", "目前登入")} {user.email}
                </div>
              )}

              <div className="login-social-grid" aria-label={t("Social login options", "社群登入選項")}>
                <button
                  type="button"
                  className="login-social-button login-social-google"
                  onClick={() => handleSocialLogin("google")}
                  disabled={submitting}
                >
                  <span className="login-social-mark" aria-hidden="true">G</span>
                  <span>{t("Google", "Google")}</span>
                </button>

                <button
                  type="button"
                  className={[
                    "login-social-button",
                    "login-social-facebook",
                    !isFacebookLoginEnabled ? "login-social-disabled" : "",
                  ].join(" ")}
                  onClick={() => handleSocialLogin("facebook")}
                  disabled={submitting}
                >
                  <span className="login-social-mark" aria-hidden="true">f</span>
                  <span>{t("Facebook", "Facebook")}</span>
                </button>
              </div>

              <div className="login-divider">
                <span>{t("or continue with email", "或使用 Email 繼續")}</span>
              </div>

              {!isLogin && (
                <div className="login-field">
                  <UserRound className="login-field-icon" size={20} strokeWidth={2.8} />
                  <input
                    className="login-field-input"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder={t("Username", "使用者名稱")}
                    required
                  />
                </div>
              )}

              <div className="login-field">
                <Mail className="login-field-icon" size={20} strokeWidth={2.8} />
                <input
                  type="email"
                  className="login-field-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={isLogin ? t("Email Address", "Email 地址") : t("Email Address", "Email 地址")}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="login-field">
                <Lock className="login-field-icon" size={20} strokeWidth={2.8} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="login-field-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("Password", "密碼")}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  className="login-field-action"
                  onClick={() => setShowPassword((value) => !value)}
                  title={showPassword ? t("Hide password", "隱藏密碼") : t("Show password", "顯示密碼")}
                >
                  {showPassword ? (
                    <EyeOff size={20} strokeWidth={2.8} />
                  ) : (
                    <Eye size={20} strokeWidth={2.8} />
                  )}
                </button>
              </div>

              <button className="login-submit" disabled={submitting || !authReady}>
                {submitting
                  ? t("PROCEEDING...", "處理中...")
                  : isLogin
                    ? t("LOG IN", "立即登入")
                    : t("REGISTER", "立即註冊")}
              </button>

              {isLogin && (
                <button
                  type="button"
                  className="login-forgot-button"
                  onClick={() => {
                    const query = email.trim()
                      ? `?email=${encodeURIComponent(email.trim())}`
                      : "";
                    router.push(`/reset-password${query}`);
                  }}
                >
                  {t("Forgot password?", "忘記密碼？")}
                </button>
              )}

              {(status || authError) && (
                <div className="login-auth-status">
                  {status || authError}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setStatus("");
                  setIsLogin((value) => !value);
                }}
                className="login-switch"
              >
                {isLogin ? t("No account? ", "還沒有帳號？") : t("Already have an account? ", "已經有帳號？")}
                <span className="login-switch-accent">
                  {isLogin ? t("Register", "註冊") : t("Login", "登入")}
                </span>
              </button>

              <p className="login-access-note">
                {t(
                  "A verified account is required to use the app.",
                  "需要完成驗證的帳號才能使用 App。"
                )}
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
