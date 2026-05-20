"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Map, Settings } from "lucide-react";
import { useAppPreferences } from "@/components/AppPreferencesProvider";

const navItems = [
  { href: "/home", icon: Home, en: "Home", zh: "首頁" },
  { href: "/records", icon: Map, en: "Records", zh: "紀錄" },
  { href: "/summary", icon: BarChart3, en: "Summary", zh: "總覽" },
  { href: "/setup", icon: Settings, en: "Setup", zh: "設定" },
];

export default function OriginalBottomNav() {
  const pathname = usePathname();
  const { prefs } = useAppPreferences();

  return (
    <nav className="bottom-nav">
      <div
        className={[
          "bottom-nav-panel",
          prefs.darkMode ? "bottom-nav-panel--dark" : "bottom-nav-panel--light",
        ].join(" ")}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/home" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className="bottom-nav-link"
            >
              <div
                className={[
                  "bottom-nav-icon",
                  active
                    ? "bottom-nav-icon--active"
                    : prefs.darkMode
                      ? ""
                      : "bottom-nav-icon--light",
                ].join(" ")}
              >
                <Icon size={20} strokeWidth={active ? 3 : 2.5} />
              </div>

              <span
                className={[
                  "bottom-nav-label",
                  active
                    ? "bottom-nav-label--active"
                    : prefs.darkMode
                      ? ""
                      : "bottom-nav-label--light",
                ].join(" ")}
              >
                {prefs.chinese ? item.zh : item.en}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
