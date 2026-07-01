import { Link, useNavigate } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import wc26Logo from "@/assets/wc26-logo.svg";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="container-app flex items-center justify-between h-14">
        <Link to="/" className="display text-lg font-semibold tracking-tight flex items-center gap-2">
          <img src={wc26Logo} alt="" className="h-7 w-auto" />
          WC26
        </Link>
        {user ? (
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="hover:text-primary" activeProps={{ className: "text-primary font-medium" }}>Home</Link>
            <Link to="/fixtures" className="hover:text-primary" activeProps={{ className: "text-primary font-medium" }}>Fixtures</Link>
            <Link to="/profile" className="hover:text-primary" activeProps={{ className: "text-primary font-medium" }}>Profile</Link>
            <ThemeToggle />
          </nav>
        ) : (
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Log in</Link>
            <Link to="/signup" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90 font-medium">Sign up</Link>
            <ThemeToggle />
          </nav>
        )}
      </div>
    </header>
  );
}
