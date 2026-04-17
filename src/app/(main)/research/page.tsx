/**
 * Research workspace overview — redirects to /research/pages.
 *
 * Keeps the /research root URL functional: a direct visit lands on the Pages
 * sub-screen rather than an empty shell. Server-side redirect so there is no
 * flash of an empty page.
 *
 * P4-01: Research workspace structure + navigation.
 *
 * Stitch reference: "Research Home" (ID: 0cf6fb7b27d9459e8b5bebfea66915c5)
 */

import { redirect } from "next/navigation";

export default function ResearchPage() {
  redirect("/research/pages");
}
