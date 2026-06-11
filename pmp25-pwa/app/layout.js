import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import AuthGate from "@/components/AuthGate";
import { AppPreferencesProvider } from "@/components/AppPreferencesProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import ViewportSizeSync from "@/components/ViewportSizeSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "PM2.5",
    template: "%s | PM2.5",
  },
  description: "Track PM2.5 exposure, live routes, records, summaries, and profile settings.",
  applicationName: "PM2.5",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "PM2.5",
    statusBarStyle: "black-translucent",
    startupImage: [],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#050910",
};

const themeInitScript = `
  (() => {
    try {
      const raw = localStorage.getItem("pmp25_setup_preferences");
      const prefs = raw ? JSON.parse(raw) : {};
      const darkMode = prefs.darkMode !== false;
      const theme = darkMode ? "dark" : "light";
      const lang = prefs.chinese ? "zh" : "en";

      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.lang = lang;
      document.documentElement.lang = prefs.chinese ? "zh-Hant" : "en";
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.dataset.lang = "en";
      document.documentElement.style.colorScheme = "dark";
    }
  })();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ViewportSizeSync />
        <AuthProvider>
          <AppPreferencesProvider>
            <AuthGate>{children}</AuthGate>
          </AppPreferencesProvider>
        </AuthProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
