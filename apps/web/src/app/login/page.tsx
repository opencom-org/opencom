"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@opencom/ui";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useBackend } from "@/contexts/BackendContext";
import { BackendSelector } from "@/components/BackendSelector";
import { Mail, Server } from "lucide-react";
import {
  mapOtpSendError,
  mapOtpVerifyError,
  mapPasswordSignInError,
  withAuthRequestTimeout,
  type AuthUiError,
} from "@/lib/authUi";

type AuthMode = "password" | "email-code";
type EmailCodeStep = "email" | "code";

function LoginForm() {
  const router = useRouter();
  const auth = useAuthOptional();
  const { login, loginWithOTP, sendOTPCode } = auth ?? {
    login: async () => {},
    loginWithOTP: async () => {},
    sendOTPCode: async () => {},
  };
  const { activeBackend, clearBackend } = useBackend();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<AuthUiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailCodeStep, setEmailCodeStep] = useState<EmailCodeStep>("email");

  // Determine available auth methods from backend config
  const authMethods = activeBackend?.authMethods ?? ["password", "otp"];
  const hasPassword = authMethods.includes("password");
  const hasOtp = authMethods.includes("otp");

  // Default to OTP if available, otherwise password
  const [authMode, setAuthMode] = useState<AuthMode>(hasOtp ? "email-code" : "password");

  if (!activeBackend) {
    return null;
  }

  const errorMessage = error?.message;
  const showSignupCta = error?.showSignupCta;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await withAuthRequestTimeout(() => login(email, password));
      router.push("/");
    } catch (err) {
      setError(mapPasswordSignInError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await withAuthRequestTimeout(() => sendOTPCode(email));
      setEmailCodeStep("code");
    } catch (err) {
      setError(mapOtpSendError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await withAuthRequestTimeout(() => loginWithOTP(email, otpCode));
      router.push("/");
    } catch (err) {
      setError(mapOtpVerifyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (emailCodeStep === "code" && authMode === "email-code") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Enter verification code</CardTitle>
          <CardDescription>
            We sent a 6-digit code to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                <p>{errorMessage}</p>
                {showSignupCta && (
                  <Link
                    href="/signup"
                    className="mt-1 inline-flex font-medium text-red-700 underline"
                  >
                    Create an account
                  </Link>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
                autoFocus
                required
              />
            </div>

            <p className="text-sm text-muted-foreground text-center">
              The code will expire in 10 minutes.
            </p>

            <Button type="submit" className="w-full" disabled={isLoading || otpCode.length !== 6}>
              {isLoading ? "Verifying..." : "Verify Code"}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEmailCodeStep("email");
                  setOtpCode("");
                  setError(null);
                }}
              >
                Change email
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  if (isLoading) {
                    return;
                  }

                  setError(null);
                  setIsLoading(true);
                  try {
                    await withAuthRequestTimeout(() => sendOTPCode(email));
                  } catch (err) {
                    setError(mapOtpSendError(err));
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
              >
                Resend code
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Opencom</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
          <Server className="h-3 w-3" />
          <span>{activeBackend.name}</span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => clearBackend()}
          >
            Change
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {authMode === "password" && hasPassword ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                <p>{errorMessage}</p>
                {showSignupCta && (
                  <Link
                    href="/signup"
                    className="mt-1 inline-flex font-medium text-red-700 underline"
                  >
                    Create an account
                  </Link>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            {hasOtp && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setAuthMode("email-code");
                    setError(null);
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Sign in with email code
                </Button>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handleSendCode} className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                <p>{errorMessage}</p>
                {showSignupCta && (
                  <Link
                    href="/signup"
                    className="mt-1 inline-flex font-medium text-red-700 underline"
                  >
                    Create an account
                  </Link>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="otp-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="otp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <p className="text-sm text-muted-foreground">
              We&apos;ll send you a 6-digit code to sign in without a password.
            </p>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send verification code"}
            </Button>

            {hasPassword && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setAuthMode("password");
                  setError(null);
                }}
              >
                Sign in with password instead
              </Button>
            )}
          </form>
        )}

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { activeBackend } = useBackend();
  const auth = useAuthOptional();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const isLoading = auth?.isLoading ?? false;
  const defaultHomePath = auth?.defaultHomePath ?? "/inbox";
  const isHomeRouteLoading = auth?.isHomeRouteLoading ?? false;

  // Redirect authenticated users to their default home.
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isHomeRouteLoading) {
      router.replace(defaultHomePath);
    }
  }, [defaultHomePath, isAuthenticated, isHomeRouteLoading, isLoading, router]);

  // Show loading while checking auth
  if (isLoading || (isAuthenticated && isHomeRouteLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Already authenticated, redirecting
  if (isAuthenticated) {
    return null;
  }

  if (!activeBackend) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <BackendSelector />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <LoginForm />
    </div>
  );
}
