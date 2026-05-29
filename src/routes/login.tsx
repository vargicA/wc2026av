import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { GoogleSignInButton, OrDivider } from "@/components/GoogleSignInButton";
import wc26Logo from "@/assets/wc26-logo.webp";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <>
      <AppHeader />
      <main className="container-app max-w-sm pt-12">
        <div className="flex justify-center mb-6">
          <img src={wc26Logo} alt="FIFA World Cup 26" className="h-32 w-auto drop-shadow-[0_0_30px_rgba(59,130,246,0.35)]" />
        </div>
        <h1 className="display text-3xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to make your picks.</p>
        <div className="mt-6">
          <GoogleSignInButton />
          <OrDivider />
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5" />
          <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5" />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>
        <div className="mt-4 flex justify-between text-sm text-muted-foreground">
          <Link to="/reset-password" className="hover:text-foreground">Forgot password?</Link>
          <Link to="/signup" className="hover:text-foreground">Create account →</Link>
        </div>
      </main>
    </>
  );
}
