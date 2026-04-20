/**
 * Blog workspace root — redirects to /blog/posts.
 *
 * Matches the pattern used by /research → /research/pages.
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-workspace.html (ID: 201421e9905c4255ad32da8c2304b69c)
 */

import { redirect } from "next/navigation";

export default function BlogPage() {
  redirect("/blog/posts");
}
