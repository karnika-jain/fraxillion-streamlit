import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Fraxillion — bank-side fraud investigation",
    template: "%s · Fraxillion",
  },
  description:
    "Fraxillion connects alert ingestion, correlation, explainable risk, money-trail analysis, tamper-evident evidence, decisions and regulatory reporting in one investigation workflow.",
  applicationName: "Fraxillion",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0d" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem("fraxillion-theme");document.documentElement.dataset.theme=(t==="dark")?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IN"
      data-theme="light"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{ "--font-instrument-serif": '"Instrument Serif", Georgia, serif' } as React.CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
