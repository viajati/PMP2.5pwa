"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  verifyPasswordResetCode,
} from "firebase/auth";
import {
  firebaseAuth,
  firebaseMissingConfig,
  isFirebaseConfigured,
} from "@/lib/firebaseClient";
import {
  clearUserProfileData,
  subscribeUserAccount,
  upsertUserAccount,
} from "@/lib/firebaseData";
import { isAppVerifiedUser } from "@/lib/authStatus";

const AuthContext = createContext({
  user: null,
  account: null,
  authReady: false,
  firebaseReady: false,
  authError: "",
  missingConfig: [],
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  loginWithProvider: async () => {},
  logout: async () => {},
  resendVerification: async () => {},
  reloadCurrentUser: async () => {},
  resetPassword: async () => {},
  confirmResetPassword: async () => {},
  verifyResetCode: async () => {},
  updateAccountProfile: async () => {},
});

function providerFor(provider) {
  if (provider === "facebook") {
    const facebookProvider = new FacebookAuthProvider();
    facebookProvider.addScope("email");
    facebookProvider.addScope("public_profile");
    return facebookProvider;
  }

  const googleProvider = new GoogleAuthProvider();
  googleProvider.addScope("email");
  googleProvider.addScope("profile");
  googleProvider.setCustomParameters({ prompt: "select_account" });
  return googleProvider;
}

function emailActionSettings() {
  if (typeof window === "undefined") return undefined;

  return {
    url: `${window.location.origin}/verify`,
    handleCodeInApp: false,
  };
}

function resetActionSettings() {
  if (typeof window === "undefined") return undefined;

  return {
    url: `${window.location.origin}/reset-password`,
    handleCodeInApp: true,
  };
}

function friendlyError(error) {
  if (!error?.code) return error?.message || "Something went wrong.";

  const messages = {
    "auth/configuration-not-found": "Firebase Auth is not enabled for this project.",
    "auth/email-already-in-use": "An account already exists for this email.",
    "auth/invalid-continue-uri": "The verification return URL is not valid.",
    "auth/invalid-credential": "The email or password is not correct.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/missing-password": "Please enter a password.",
    "auth/operation-not-allowed": "Enable this sign-in provider in Firebase Authentication first.",
    "auth/popup-blocked": "The sign-in popup was blocked by the browser.",
    "auth/popup-closed-by-user": "The sign-in popup was closed before finishing.",
    "auth/account-exists-with-different-credential": "This email already uses another sign-in method. Log in with the original method first.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/unauthorized-domain": "Add this app domain in Firebase Authentication authorized domains.",
    "auth/unauthorized-continue-uri": "Add this app domain in Firebase Authentication authorized domains.",
    "auth/weak-password": "Use a password with at least 6 characters.",
  };

  return messages[error.code] || error.message;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) return undefined;

    let cancelled = false;

    getRedirectResult(firebaseAuth)
      .then(async (result) => {
        if (!result?.user) return;

        if (isAppVerifiedUser(result.user)) await upsertUserAccount(result.user);
        if (!cancelled) {
          setUser(result.user);
          setAuthError("");
        }
      })
      .catch((error) => {
        if (!cancelled) setAuthError(friendlyError(error));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) return undefined;

    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setAuthError("");

      if (nextUser && isAppVerifiedUser(nextUser)) {
        try {
          await upsertUserAccount(nextUser);
        } catch (error) {
          console.warn("Unable to sync Firebase account:", error);
        }
      } else if (nextUser && !isAppVerifiedUser(nextUser)) {
        clearUserProfileData(nextUser.uid).catch((error) => {
          console.warn("Unable to clear unverified Firestore profile:", error);
        });
      }

      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !user?.uid || !isAppVerifiedUser(user)) {
      queueMicrotask(() => setAccount(null));
      return undefined;
    }

    return subscribeUserAccount(
      user.uid,
      setAccount,
      (error) => {
        console.warn("Unable to subscribe to account:", error);
        setAuthError(friendlyError(error));
      }
    );
  }, [user]);

  const runAuth = useCallback(async (action) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      const message = "Add Firebase environment variables before using login.";
      setAuthError(message);
      throw new Error(message);
    }

    setAuthError("");

    try {
      const result = await action();
      if (isAppVerifiedUser(result?.user)) await upsertUserAccount(result.user);
      return result;
    } catch (error) {
      const message = friendlyError(error);
      setAuthError(message);
      throw new Error(message);
    }
  }, []);

  const loginWithEmail = useCallback((email, password) => {
    return runAuth(() => signInWithEmailAndPassword(firebaseAuth, email, password));
  }, [runAuth]);

  const registerWithEmail = useCallback((email, password, displayName = "") => {
    return runAuth(async () => {
      const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);

      if (displayName.trim()) {
        await updateProfile(result.user, { displayName: displayName.trim() });
      }

      await sendEmailVerification(result.user, emailActionSettings());
      return result;
    });
  }, [runAuth]);

  const loginWithProvider = useCallback((provider, languageCode = "en") => {
    return runAuth(async () => {
      firebaseAuth.languageCode = languageCode;
      const authProvider = providerFor(provider);

      try {
        const result = await signInWithPopup(firebaseAuth, authProvider);
        if (isAppVerifiedUser(result.user)) await upsertUserAccount(result.user);
        return result;
      } catch (error) {
        const shouldRedirect = [
          "auth/popup-blocked",
          "auth/popup-closed-by-user",
          "auth/cancelled-popup-request",
        ].includes(error?.code);

        if (!shouldRedirect) throw error;

        await signInWithRedirect(firebaseAuth, authProvider);
        return { redirecting: true };
      }
    });
  }, [runAuth]);

  const logout = useCallback(() => {
    return runAuth(() => signOut(firebaseAuth));
  }, [runAuth]);

  const resendVerification = useCallback(async () => {
    if (!firebaseAuth?.currentUser) {
      throw new Error("Sign in before requesting a verification email.");
    }

    await runAuth(() => sendEmailVerification(
      firebaseAuth.currentUser,
      emailActionSettings()
    ));
  }, [runAuth]);

  const reloadCurrentUser = useCallback(async () => {
    if (!firebaseAuth?.currentUser) return null;
    await firebaseAuth.currentUser.reload();
    setUser(firebaseAuth.currentUser);
    if (isAppVerifiedUser(firebaseAuth.currentUser)) {
      await upsertUserAccount(firebaseAuth.currentUser);
    }
    return firebaseAuth.currentUser;
  }, []);

  const resetPassword = useCallback((email) => {
    return runAuth(() => sendPasswordResetEmail(
      firebaseAuth,
      email,
      resetActionSettings()
    ));
  }, [runAuth]);

  const verifyResetCode = useCallback((code) => {
    return runAuth(() => verifyPasswordResetCode(firebaseAuth, code));
  }, [runAuth]);

  const confirmResetPassword = useCallback((code, nextPassword) => {
    return runAuth(() => confirmPasswordReset(firebaseAuth, code, nextPassword));
  }, [runAuth]);

  const updateAccountProfile = useCallback(async (patch) => {
    if (!firebaseAuth?.currentUser) return;

    await runAuth(async () => {
      await updateProfile(firebaseAuth.currentUser, patch);

      if (isAppVerifiedUser(firebaseAuth.currentUser)) {
        await upsertUserAccount(firebaseAuth.currentUser);
      }

      setAccount((current) => ({
        ...(current || {}),
        uid: firebaseAuth.currentUser.uid,
        email: firebaseAuth.currentUser.email || current?.email || "",
        displayName: firebaseAuth.currentUser.displayName || current?.displayName || "",
        photoURL: firebaseAuth.currentUser.photoURL || current?.photoURL || "",
        emailVerified: isAppVerifiedUser(firebaseAuth.currentUser),
      }));

      return { user: firebaseAuth.currentUser };
    });
  }, [runAuth]);

  const value = useMemo(() => ({
    user,
    account,
    authReady,
    firebaseReady: isFirebaseConfigured,
    authError,
    missingConfig: firebaseMissingConfig,
    loginWithEmail,
    registerWithEmail,
    loginWithProvider,
    logout,
    resendVerification,
    reloadCurrentUser,
    resetPassword,
    confirmResetPassword,
    verifyResetCode,
    updateAccountProfile,
  }), [
    account,
    authError,
    authReady,
    loginWithEmail,
    loginWithProvider,
    logout,
    registerWithEmail,
    reloadCurrentUser,
    resendVerification,
    resetPassword,
    confirmResetPassword,
    verifyResetCode,
    updateAccountProfile,
    user,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
