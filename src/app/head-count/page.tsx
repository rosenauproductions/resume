import type { Metadata, Viewport } from "next";
import HeadCountApp from "@/components/head-count/HeadCountApp";

export const metadata: Metadata = {
  title: "Head Count",
  description:
    "On-device room counter for the back of the room. Finds head shapes — hair, hats, crowns — not faces. Video never leaves the phone.",
  manifest: "/head-count/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Head Count",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/head-count/icon.svg",
    apple: "/head-count/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#090b0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function HeadCountPage() {
  return <HeadCountApp />;
}
