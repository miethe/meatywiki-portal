/**
 * Authenticated shell layout — (main) route group.
 *
 * Server component: performs auth check + redirects unauthenticated users.
 * Delegates rendering to ShellClient (client component) which owns mobile
 * drawer state.
 *
 * P3-10: Extracted mobile drawer logic into ShellClient to fix broken mobile
 *        nav on < 768px viewports.
 *
 * Stitch reference: "Unified Shell — Standard Archival"
 * Auth: P3-01 | Navigation wiring: P3-02
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ShellClient } from "./shell-client";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Double-check auth here in addition to middleware (defence in depth)
  if (!session) {
    redirect("/login");
  }

  return <ShellClient>{children}</ShellClient>;
}
