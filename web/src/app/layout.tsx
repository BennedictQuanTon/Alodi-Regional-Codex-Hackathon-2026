import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Landing, demo and dashboard: stand-ins for Monad's Untitled Serif / ABC Diatype Mono / Untitled Sans
const serif = Source_Serif_4({
  variable: "--font-serif-face",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
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
    "Alodi is the agentic recovery system for last-mile delivery in Vietnam. One shipper tap starts chat and voice outreach, and the next shipper gets a rule-checked card: when, where and who.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${logo.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
