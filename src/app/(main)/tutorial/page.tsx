/**
 * Tutorial page — server component wrapper.
 *
 * Static page: no server-side data fetching required.
 * All copy lives in src/lib/copy/tutorial.ts (FLOW_CARDS).
 * Delegates all interactive behaviour to TutorialClient.
 */

import type { Metadata } from "next";
import TutorialClient from "./TutorialClient";

export const metadata: Metadata = {
  title: "Tutorial — MeatyWiki",
  description:
    "Learn how to use MeatyWiki — step-by-step flows covering intake, compilation, research, decisions, lens scoring, and graph exploration.",
};

export default function TutorialPage() {
  return <TutorialClient />;
}
