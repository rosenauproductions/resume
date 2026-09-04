import type { Metadata } from "next";
import { PipelineApp } from "@/components/pipeline/PipelineApp";

export const metadata: Metadata = {
  title: "Pipeline",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const dynamic = "force-dynamic";

function deployInfo() {
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  return {
    sha: sha ? sha.slice(0, 7) : "local",
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    url: process.env.VERCEL_URL || null,
  };
}

export default function PipelinePage() {
  return <PipelineApp deploy={deployInfo()} />;
}
