"use client";

/**
 * LoginForm — client component.
 *
 * Submits the bearer token to POST /api/auth/session (Next.js route handler).
 * On success, the route handler sets the HttpOnly cookie and this component
 * navigates to the destination (`next` param or `/`).
 *
 * INVARIANT: The token is never stored in localStorage or component state
 * beyond the lifetime of this form. The route handler owns cookie placement.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, Suspense } from "react";
import { cn } from "@/lib/utils";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const destination = searchParams.get("next") ?? "/";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError("Please enter an access token.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.trim() }),
        });

        if (response.ok) {
          // Cookie is now set by the server; navigate to the intended destination.
          router.push(destination);
          router.refresh();
        } else {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? "Authentication failed. Check your token.");
        }
      } catch {
        setError("Could not reach the server. Is the backend running?");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <label
          htmlFor="token"
          className="block text-sm font-medium leading-none"
        >
          Access Token
        </label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Paste your bearer token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={isPending}
          aria-describedby={error ? "token-error" : undefined}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus:ring-destructive",
          )}
        />
        {error && (
          <p
            id="token-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending || !token.trim()}
        className={cn(
          "inline-flex h-10 w-full items-center justify-center rounded-md",
          "bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
          "transition-colors hover:bg-primary/90",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

/**
 * LoginForm wrapped in Suspense because useSearchParams() requires it in
 * Next.js 15 App Router when used inside a Client Component on a static page.
 */
export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading login form">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}
