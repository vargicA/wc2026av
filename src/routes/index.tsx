import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  return (
    <>
      <AppHeader />
      <main className="container-app">
        <section className="pt-16 pb-12 text-center">
          <span className="pill bg-accent text-accent-foreground">11 June – 19 July 2026</span>
          <h1 className="display mt-4 text-5xl sm:text-6xl font-semibold leading-[0.95]">
            Predict the World Cup.<br />
            <span className="text-primary">Beat your friends.</span>
          </h1>
          <p className="mt-5 max-w-md mx-auto text-muted-foreground">
            All 104 matches. Private leagues for your group chat. Auto-scored. Done.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link to="/signup" className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">
              Get started
            </Link>
            <Link to="/login" className="rounded-md border border-input px-5 py-3 font-medium hover:bg-accent">
              I have an account
            </Link>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3 pb-16">
          {[
            { n: "01", t: "Sign up", d: "Email and password. Under a minute." },
            { n: "02", t: "Create a league", d: "Share the invite code with your group." },
            { n: "03", t: "Predict & climb", d: "3 pts exact score, 1 pt right winner." },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border border-border bg-card p-5">
              <div className="display text-3xl text-primary">{s.n}</div>
              <div className="mt-1 font-medium">{s.t}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
