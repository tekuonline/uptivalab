import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { useAuth } from "../providers/auth-context.js";

export const InviteAcceptRoute = () => {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated } = useAuth();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    role: string;
    expiresAt: string;
  } | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    // Verify invitation token
    const verifyInvitation = async () => {
      try {
        const res = await fetch(`/api/invitations/verify/${token}`);
        if (res.ok) {
          const data = await res.json();
          setInviteInfo(data);
        } else {
          const data = await res.json();
          setError(data.message || "Invalid or expired invitation");
        }
      } catch (err) {
        setError("Failed to verify invitation");
      }
    };

    if (token && !isAuthenticated) {
      verifyInvitation();
    }
  }, [token, isAuthenticated]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (accepted) {
    return <Navigate to="/login" replace />;
  }

  const handleAccept = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (password !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("uptivalab.token", data.token);
        setAccepted(true);
      } else {
        const data = await res.json();
        setError(data.message || "Failed to accept invitation");
      }
    } catch (err) {
      setError("An error occurred while accepting the invitation");
    } finally {
      setLoading(false);
    }
  };

  if (!inviteInfo && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="glass-panel w-full max-w-md space-y-6 rounded-3xl p-8">
          <p className="text-center text-slate-400">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="glass-panel w-full max-w-md space-y-6 rounded-3xl p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">UPTIVALAB</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Invalid Invitation</h1>
          </div>
          <p className="text-red-400">{error}</p>
          <Button onClick={() => window.location.href = "/login"} className="w-full">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="glass-panel w-full max-w-md space-y-6 rounded-3xl p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">UPTIVALAB</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Accept Invitation</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You've been invited to join as a {inviteInfo?.role.toLowerCase()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
          <p className="font-medium text-slate-900 dark:text-white">{inviteInfo?.email}</p>
        </div>

        <form className="space-y-4" onSubmit={handleAccept}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Password</label>
            <input
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Repeat Password</label>
            <input
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              type="password"
              placeholder="Repeat your password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating Account..." : "Accept Invitation"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-600 dark:text-slate-400">
          This invitation expires on {inviteInfo && new Date(inviteInfo.expiresAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};
