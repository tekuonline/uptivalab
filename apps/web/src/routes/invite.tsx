import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { useTranslation } from "../lib/i18n.js";
import { useAuth } from "../providers/auth-context.js";
import { api } from "../lib/api.js";

export const InviteAcceptRoute = () => {
  const { t } = useTranslation();
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
        const data = await api.verifyInvitation(token!);
        setInviteInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid or expired invitation");
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
      const data = await api.acceptInvitation({ token: token!, password });
      localStorage.setItem("uptivalab.token", data.token);
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  if (!inviteInfo && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground px-4 py-8">
        <div className="glass-panel w-full max-w-md space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl p-6 sm:p-8">
          <p className="text-center text-xs sm:text-sm text-slate-400">{t("verifyingInvitation")}</p>
        </div>
      </div>
    );
  }

  if (error && !inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground px-4 py-8">
        <div className="glass-panel w-full max-w-md space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl p-6 sm:p-8">
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.35em] text-slate-400">UPTIVALAB</p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">{t("invalidInvitation")}</h1>
          </div>
          <p className="text-sm text-red-400">{error}</p>
          <Button onClick={() => window.location.href = "/login"} className="w-full">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground px-4 py-8">
      <div className="glass-panel w-full max-w-md space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl p-6 sm:p-8">
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.35em] text-slate-400">UPTIVALAB</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">{t("acceptInvitation")}</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            You've been invited to join as a {inviteInfo?.role.toLowerCase()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{t("email")}</p>
          <p className="font-medium text-sm sm:text-base text-slate-900 dark:text-white break-all">{inviteInfo?.email}</p>
        </div>

        <form className="space-y-3 sm:space-y-4" onSubmit={handleAccept}>
          <div className="space-y-1 sm:space-y-2">
            <label className="text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.4em] text-slate-400">{t("password")}</label>
            <input
              className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 sm:px-4 py-2 sm:py-3 text-sm text-slate-900 dark:text-white"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <label className="text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.4em] text-slate-400">{t("repeatPassword")}</label>
            <input
              className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 sm:px-4 py-2 sm:py-3 text-sm text-slate-900 dark:text-white"
              type="password"
              placeholder={t("repeatYourPassword")}
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("creatingAccount") : t("acceptInvitation")}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-600 dark:text-slate-400">
          This invitation expires on {inviteInfo && new Date(inviteInfo.expiresAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};
