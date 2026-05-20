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
    <nav className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] mx-auto flex max-w-[430px] justify-center px-5">
      <div
        className={[
          "pointer-events-auto grid w-full grid-cols-4 rounded-[28px] border p-2 backdrop-blur-xl",
          prefs.darkMode
            ? "border-white/10 bg-[#101217]/92 shadow-[0_18px_44px_rgba(0,0,0,0.34)]"
            : "border-black/8 bg-white/92 shadow-[0_18px_44px_rgba(15,23,42,0.14)]",
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
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-[22px] px-2 py-2"
            >
              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-[18px] transition",
                  active
                    ? "bg-[#00D2FF] text-white shadow-[0_0_18px_rgba(0,210,255,0.28)]"
                    : prefs.darkMode
                      ? "text-white/42"
                      : "text-slate-400",
                ].join(" ")}
              >
                <Icon size={20} strokeWidth={active ? 3 : 2.5} />
              </div>

              <span
                className={[
                  "text-[9px] font-black leading-none tracking-[0.04em]",
                  active
                    ? "text-[#00D2FF]"
                    : prefs.darkMode
                      ? "text-white/34"
                      : "text-slate-400",
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
