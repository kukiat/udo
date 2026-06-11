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
  title: {
    default: "Udo | RMS",
    template: "Udo | %s",
  },
  description: "Self-Order, KDS & Menu Management",
  icons: {
    icon: [{ url: "/uploads/favicon.ico", type: "image/x-icon" }],
    shortcut: [{ url: "/uploads/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/uploads/favicon.ico", type: "image/x-icon" }],
  },
};

// Runs before hydration so the persisted theme is applied to <html> on first
// paint. Client theme state reads the same storage keys during initialization,
// so hydration does not briefly revert dark pages back to light.
const themeBootstrap = `(function(){try{var p=location.pathname;var key=null;var fallback='light';if(p.indexOf('/dashboard')===0){key='rms.dashboard.theme';}else if(p.indexOf('/kds')===0){key='rms.kds.theme';}else if(p.indexOf('/pos')===0){key='rms.pos.theme';fallback='dark';}else if(p.indexOf('/waitstaff')===0){key='rms.waitstaff.theme';}if(!key)return;var stored=localStorage.getItem(key);var theme=stored==='light'||stored==='dark'?stored:fallback;document.documentElement.classList.add('kds-theme');document.documentElement.classList.toggle('kds-dark',theme==='dark');document.documentElement.style.colorScheme=theme;}catch(e){}})();`;

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
