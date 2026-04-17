/**
 * Authenticated landing — (main) root.
 *
 * In practice, the root "/" redirect goes to "/inbox" (handled in
 * src/app/page.tsx). This page exists as a fallback so that if the redirect
 * somehow fails, the shell still renders something meaningful.
 *
 * Real content screens (Inbox, Library, Artifact Detail) land in P3-03..P3-07.
 */

import { redirect } from "next/navigation";

export default function MainRootPage() {
  // Belt-and-suspenders redirect — middleware and root page.tsx handle this
  // for the typical request path, but cover the edge case here too.
  redirect("/inbox");
}
