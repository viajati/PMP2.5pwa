"use client";

import { useEffect } from "react";

export default function ViewportSizeSync() {
  useEffect(() => {
    function syncViewportHeight() {
      const visualHeight = window.visualViewport?.height || 0;
      const innerHeight = window.innerHeight || 0;
      const clientHeight = document.documentElement.clientHeight || 0;
      const standalone =
        window.navigator.standalone === true ||
        window.matchMedia?.("(display-mode: standalone)")?.matches;
      const height = standalone
        ? Math.max(visualHeight, innerHeight, clientHeight)
        : (visualHeight || innerHeight || clientHeight);

      if (!height) return;

      document.documentElement.style.setProperty("--app-height", `${height}px`);
      window.dispatchEvent(new Event("app:viewport-sync"));
    }

    const syncSoon = () => {
      syncViewportHeight();
      window.requestAnimationFrame(syncViewportHeight);
      [80, 240, 600].forEach((delay) => window.setTimeout(syncViewportHeight, delay));
    };

    syncSoon();

    window.addEventListener("resize", syncSoon);
    window.addEventListener("orientationchange", syncSoon);
    window.addEventListener("pageshow", syncSoon);
    document.addEventListener("visibilitychange", syncSoon);
    window.visualViewport?.addEventListener("resize", syncSoon);

    return () => {
      window.removeEventListener("resize", syncSoon);
      window.removeEventListener("orientationchange", syncSoon);
      window.removeEventListener("pageshow", syncSoon);
      document.removeEventListener("visibilitychange", syncSoon);
      window.visualViewport?.removeEventListener("resize", syncSoon);
    };
  }, []);

  return null;
}
