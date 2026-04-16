import { redirect } from "next/navigation";

/**
 * Root route — redirect to the inbox.
 * Auth middleware (added in P3-01) will intercept unauthenticated requests
 * and redirect to /login before this executes.
 */
export default function RootPage() {
  redirect("/inbox");
}
