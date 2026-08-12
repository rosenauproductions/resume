import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VisitNotifier } from "@/components/VisitNotifier";
import "./globals.css";

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://resume-rho-taupe.vercel.app"),
  title: "Chris Rosenau — Multimedia Designer & Learning Media Specialist",
  description:
    "Multimedia design, graphic arts, video production, LMS administration, and eLearning. Dallas-based learning media specialist.",
  openGraph: {
    title: "Chris Rosenau — Multimedia Designer & Learning Media Specialist",
    description:
      "Multimedia design, graphic arts, video, LMS management, and interactive learning experiences.",
    url: "https://resume-rho-taupe.vercel.app",
    siteName: "Chris Rosenau",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/og-preview.jpg",
        width: 1200,
        height: 630,
        alt: "Chris Rosenau — Multimedia Designer & Learning Media Specialist",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chris Rosenau — Multimedia Designer & Learning Media Specialist",
    description:
      "Multimedia design, graphic arts, video, LMS management, and interactive learning experiences.",
    images: ["/images/og-preview.jpg"],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <VisitNotifier />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
