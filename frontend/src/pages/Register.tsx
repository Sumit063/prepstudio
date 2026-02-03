import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { loginUser, registerUser } from "../lib/api";
import { setAuthTokens } from "../lib/auth";

export const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.username || !form.password) {
      setError("Username and password are required.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await registerUser({
        username: form.username,
        password: form.password,
        email: form.email || undefined,
      });
      const tokens = await loginUser({
        username: form.username,
        password: form.password,
      });
      setAuthTokens(tokens.access, tokens.refresh, form.username);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
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
                placeholder="prepstudent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email (optional)</label>
              <Input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Password</label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Create a password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Confirm password</label>
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm({ ...form, confirmPassword: event.target.value })
                }
                placeholder="Re-enter password"
              />
            </div>
            {error && (
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create account"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-accent hover:text-accent-hover">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
