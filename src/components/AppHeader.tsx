import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import wc26Logo from "@/assets/wc26-logo.svg";

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="container-app flex items-center justify-between h-14">
        <Link to="/" className="display text-lg font-semibold tracking-tight flex items-center gap-2">
          <img src={wc26Logo} alt="" className="h-7 w-auto" />
          WC26 <span className="text-muted-foreground font-normal">Predictor</span>
        </Link>
        {user ? (
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="hover:text-primary" activeProps={{ className: "text-primary font-medium" }}>Home</Link>
            <Link to="/fixtures" className="hover:text-primary" activeProps={{ className: "text-primary font-medium" }}>Fixtures</Link>
            <Link to="/profile" className="hover:text-primary" activeProps={{ className: "text-primary font-medium" }}>Profile</Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
              className="text-muted-foreground hover:text-foreground"
            >Sign out</button>
          </nav>
        ) : (
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Log in</Link>
            <Link to="/signup" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90 font-medium">Sign up</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
