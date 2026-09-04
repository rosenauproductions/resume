import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VisitNotifier } from "@/components/VisitNotifier";
import { dbConfigured } from "@/lib/db";
import { DEFAULT_SITE_DEPLOY, getSiteDeploySetting } from "@/lib/db/settings";
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

export async function generateMetadata(): Promise<Metadata> {
  let deploy = { ...DEFAULT_SITE_DEPLOY };
  if (dbConfigured()) {
    try {
      deploy = await getSiteDeploySetting();
    } catch {
      // defaults
    }
  }

  const base = deploy.publicUrl || DEFAULT_SITE_DEPLOY.publicUrl;
  return {
    metadataBase: new URL(base),
    title: deploy.metaTitle,
    description: deploy.metaDescription,
    openGraph: {
      title: deploy.metaTitle,
      description: deploy.metaDescription,
      url: base,
      siteName: deploy.siteName,
      locale: "en_US",
      type: "website",
      images: [
        {
          url: "/images/og-preview.jpg",
          width: 1200,
          height: 630,
          alt: deploy.metaTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: deploy.metaTitle,
      description: deploy.metaDescription,
      images: ["/images/og-preview.jpg"],
    },
  };
}

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
