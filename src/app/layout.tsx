import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Marrow — RMS",
  description: "Self-Order, KDS & Menu Management",
};

// Runs before hydration so the persisted theme is applied to <html> on first
// paint — prevents a flash of light theme when the user saved dark previously.
// Components (DashboardShell, KDS page) keep this class in sync via useEffect.
const themeBootstrap = `(function(){try{var p=location.pathname;if(p.indexOf('/kds')===0){if(localStorage.getItem('rms.kds.theme')==='dark'){document.documentElement.classList.add('kds-theme','kds-dark');}}else if(p.indexOf('/dashboard')===0){document.documentElement.classList.add('kds-theme');if(localStorage.getItem('rms.dashboard.theme')==='dark'){document.documentElement.classList.add('kds-dark');}}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-cream text-ink font-sans" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
