/**
 * Login page — stub.
 *
 * P3-01 implements:
 * - Bearer token form (single-user local auth)
 * - Token stored in HttpOnly cookie via POST /api/auth/session
 * - Redirect to /inbox on success
 *
 * shadcn/ui primitives to use: Card, Input, Button, Label, Form
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="rounded border p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold">MeatyWiki Portal</h1>
        <p className="text-muted-foreground text-sm">
          Login form — implemented in P3-01
        </p>
      </div>
    </main>
  );
}
