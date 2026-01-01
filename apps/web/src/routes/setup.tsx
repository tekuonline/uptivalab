import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { useTranslation } from "../hooks/use-translation.js";
import { useAuth } from "../providers/auth-context.js";

const SetupForm = () => {
  const { t } = useTranslation();
  const { setup, isAuthenticated, setupNeeded } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Show loading while setup status is being determined
  if (setupNeeded === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white mx-auto"></div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("checkingSetupStatus")}</p>
        </div>
      </div>
    );
  }

  // If setup is not needed and user is authenticated, redirect to dashboard
  if (!setupNeeded && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // If setup is not needed but user is not authenticated, redirect to login
  if (!setupNeeded && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      await setup({ email: form.email, password: form.password });
      setSuccess(true);

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="glass-panel w-full max-w-md space-y-6 rounded-3xl p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{t("setupComplete")}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {t("redirectingToDashboard")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="glass-panel w-full max-w-md space-y-6 rounded-3xl p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{t("uptivalab")}</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{t("welcomeToUptivaLab")}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("createFirstAdminAccount")}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-slate-400">{t("email")}</label>
            <input
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-slate-400">{t("password")}</label>
            <input
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-slate-400">{t("confirmPassword")}</label>
            <input
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
              minLength={8}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 py-3 font-medium"
          >
            {loading ? t("creatingAccount") : t("createAdminAccount")}
          </Button>
        </form>
      </div>
    </div>
  );
};

export const SetupRoute = () => <SetupForm />;