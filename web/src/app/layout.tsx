import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Landing, demo and dashboard: stand-ins for Monad's Untitled Serif / ABC Diatype Mono / Untitled Sans
const serif = Source_Serif_4({
  variable: "--font-serif-face",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const mono = Geist_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const sans = Geist({
  variable: "--font-sans-face",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Alodi wordmark + taglines (brand sheet: Be Vietnam Pro ExtraBold / Medium)
const logo = Be_Vietnam_Pro({
  variable: "--font-logo-face",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "800"],
});

export const metadata: Metadata = {
  title: "Alodi · Make the second drop land",
  description:
    "Alodi rescues failed deliveries. The courier taps one button; the agent messages and calls the buyer, then hands back structured context for the next attempt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${mono.variable} ${sans.variable} ${logo.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
