"use client";

import { useEffect } from "react";

export default function ViewportSizeSync() {
  useEffect(() => {
    function syncViewportHeight() {
      const height = window.visualViewport?.height || window.innerHeight;
      if (!height) return;

      document.documentElement.style.setProperty("--app-height", `${height}px`);
    }

    syncViewportHeight();

    window.addEventListener("resize", syncViewportHeight);
    window.addEventListener("orientationchange", syncViewportHeight);
    window.addEventListener("pageshow", syncViewportHeight);
    document.addEventListener("visibilitychange", syncViewportHeight);
    window.visualViewport?.addEventListener("resize", syncViewportHeight);

    return () => {
      window.removeEventListener("resize", syncViewportHeight);
      window.removeEventListener("orientationchange", syncViewportHeight);
      window.removeEventListener("pageshow", syncViewportHeight);
      document.removeEventListener("visibilitychange", syncViewportHeight);
      window.visualViewport?.removeEventListener("resize", syncViewportHeight);
    };
  }, []);

  return null;
}
