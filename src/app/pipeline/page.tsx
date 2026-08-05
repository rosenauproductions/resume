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

export default function PipelinePage() {
  return <PipelineApp />;
}
