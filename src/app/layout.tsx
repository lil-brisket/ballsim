import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Condensed scoreboard face for numerals, team names and section headings. */
const displayFont = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Basketball",
  description: "Fictional basketball simulation and franchise management.",
  other: {
    "darkreader-lock": "true",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#09090b",
  viewportFit: "cover",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-zinc-950 text-zinc-100"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
