import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { loginUser, loginWithGoogle } from "../lib/api";
import { setAuthTokens } from "../lib/auth";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const demoCredentials = { username: "demo", password: "demo-password" };

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string })?.from || "/";
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitialized = useRef(false);

  const handleSubmit = async (payload = form) => {
    if (!payload.username || !payload.password) {
      setError("Enter username and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tokens = await loginUser(payload);
      setAuthTokens(tokens.access, tokens.refresh, payload.username);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!googleClientId || googleInitialized.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          setLoading(true);
          setError(null);
          try {
            const tokens = await loginWithGoogle(response.credential);
            setAuthTokens(tokens.access, tokens.refresh, tokens.username ?? tokens.email);
            navigate(redirectTo, { replace: true });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Google login failed.");
          } finally {
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 320,
      });
      googleInitialized.current = true;
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [googleClientId, navigate, redirectTo]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Username</label>
              <Input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="demo"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Password</label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="????????"
              />
            </div>
            {error && (
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setForm(demoCredentials);
                  handleSubmit(demoCredentials);
                }}
              >
                Use demo login
              </Button>
            </div>

            {googleClientId && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  Google
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div
                  ref={googleButtonRef}
                  className="flex w-full justify-center"
                />
                <p className="text-[11px] text-muted-foreground">
                  Google sign-in is available when a client ID is configured.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              No account?{" "}
              <Link to="/register" className="text-accent hover:text-accent-hover">
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
