import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In — MeatyWiki Portal",
  description: "Enter your bearer token to access MeatyWiki Portal.",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand header */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            MeatyWiki Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your access token to continue
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Local instance — single-user authentication
        </p>
      </div>
    </main>
  );
}
