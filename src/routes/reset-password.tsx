import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase recovery flow puts type=recovery in the URL hash
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setMode("update");
    }
  }, []);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setErr(error.message); else setMsg("Check your email for a reset link.");
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setErr(error.message); else setMsg("Password updated. You can now log in.");
  }

  return (
    <>
      <AppHeader />
      <main className="container-app max-w-sm pt-12">
        <h1 className="display text-3xl font-semibold">
          {mode === "update" ? "Set a new password" : "Reset your password"}
        </h1>
        {mode === "request" ? (
          <form onSubmit={sendReset} className="mt-6 space-y-3">
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5" />
            {err && <p className="text-sm text-destructive">{err}</p>}
            {msg && <p className="text-sm text-success">{msg}</p>}
            <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : (
          <form onSubmit={updatePassword} className="mt-6 space-y-3">
            <input type="password" required minLength={8} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5" />
            {err && <p className="text-sm text-destructive">{err}</p>}
            {msg && <p className="text-sm text-success">{msg}</p>}
            <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
        <div className="mt-4 text-sm text-muted-foreground">
          <Link to="/login" className="hover:text-foreground">← Back to log in</Link>
        </div>
      </main>
    </>
  );
}
