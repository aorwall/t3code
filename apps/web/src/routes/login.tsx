import { createFileRoute, redirect } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { AuthSurfaceShell } from "../components/auth/AuthSurfaceShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  consumeMoatlessAuthReturnTo,
  fetchMoatlessAuthMode,
  resolveMoatlessOAuthLoginUrl,
  submitMoatlessPasswordLogin,
  type MoatlessAuthModeState,
} from "../environments/primary";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    if (context.authGateState.status === "authenticated") {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: LoginRouteView,
});

function LoginRouteView() {
  const [authMode, setAuthMode] = useState<MoatlessAuthModeState | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingMode, setIsLoadingMode] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMoatlessAuthMode().then(
      (mode) => {
        if (cancelled) return;
        setAuthMode(mode);
        setIsLoadingMode(false);
      },
      (error) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not load auth mode.");
        setIsLoadingMode(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const loginError = await submitMoatlessPasswordLogin({ username, password }).then(
      () => null,
      (error) => error,
    );
    setIsSubmitting(false);
    if (loginError) {
      setErrorMessage(loginError instanceof Error ? loginError.message : "Authentication failed.");
      return;
    }
    window.location.replace(consumeMoatlessAuthReturnTo());
  }

  return (
    <AuthSurfaceShell>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sign in to Moatless</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Use the Moatless account for this deployment.
      </p>

      {isLoadingMode ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading sign-in options...</p>
      ) : authMode?.mode === "password" ? (
        <form className="mt-6 space-y-4" onSubmit={(event) => void handlePasswordSubmit(event)}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="moatless-username">
              Username
            </label>
            <Input
              id="moatless-username"
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              disabled={isSubmitting}
              nativeInput
              onChange={(event) => setUsername(event.currentTarget.value)}
              value={username}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="moatless-password">
              Password
            </label>
            <Input
              id="moatless-password"
              autoComplete="current-password"
              disabled={isSubmitting}
              nativeInput
              onChange={(event) => setPassword(event.currentTarget.value)}
              type="password"
              value={password}
            />
          </div>

          {errorMessage ? <AuthErrorMessage message={errorMessage} /> : null}

          <Button disabled={isSubmitting} size="sm" type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          {errorMessage ? <AuthErrorMessage message={errorMessage} /> : null}
          <Button
            render={<a href={resolveMoatlessOAuthLoginUrl(authMode?.loginUrl ?? null)} />}
            size="sm"
          >
            Sign in
          </Button>
        </div>
      )}
    </AuthSurfaceShell>
  );
}

function AuthErrorMessage({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/6 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}
