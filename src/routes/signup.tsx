import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName.trim() || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <>
      <AppHeader />
      <main className="container-app max-w-sm pt-12">
        <h1 className="display text-3xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Then invite your friends.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input required placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5" />
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5" />
          <input type="password" required minLength={8} placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5" />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>
        <div className="mt-4 text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-foreground hover:underline">Log in</Link>
        </div>
      </main>
    </>
  );
}
