"use client";

import { useState } from "react";
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
import {
  mapOtpSendError,
  mapOtpVerifyError,
  mapSignupError,
  withAuthRequestTimeout,
  type AuthUiError,
} from "@/lib/authUi";
import { Mail } from "lucide-react";

type SignupMode = "password" | "email-code";
type EmailCodeStep = "details" | "code";

function SignupForm() {
  const router = useRouter();
  const auth = useAuthOptional();
  const { signup, sendOTPCode, loginWithOTP, completeSignupProfile } = auth ?? {
    signup: async () => {},
    sendOTPCode: async () => {},
    loginWithOTP: async () => {},
    completeSignupProfile: async () => {},
  };
  const { activeBackend } = useBackend();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<AuthUiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailCodeStep, setEmailCodeStep] = useState<EmailCodeStep>("details");

  const authMethods = activeBackend?.authMethods ?? ["password", "otp"];
  const hasPassword = authMethods.includes("password");
  const hasOtp = authMethods.includes("otp");
  const [signupMode, setSignupMode] = useState<SignupMode>(hasOtp ? "email-code" : "password");

  const resetOtpState = () => {
    setEmailCodeStep("details");
    setOtpCode("");
  };

  const handleSwitchMode = (mode: SignupMode) => {
    if (mode === signupMode) {
      return;
    }
    setSignupMode(mode);
    setError(null);
    resetOtpState();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await withAuthRequestTimeout(() => signup(email, password, name, workspaceName));
      router.push("/");
    } catch (err) {
      setError(mapSignupError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      return;
    }

    if (!name.trim() || !email.trim()) {
      setError({
        code: "generic",
        message: "Name and email are required to sign up with an email code.",
      });
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await withAuthRequestTimeout(() => sendOTPCode(email));
      setEmailCodeStep("code");
      setOtpCode("");
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

    if (!name.trim() || !email.trim() || otpCode.trim().length !== 6) {
      setError({
        code: "generic",
        message: "Enter name, email, and a valid 6-digit verification code.",
      });
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await withAuthRequestTimeout(() => loginWithOTP(email, otpCode.trim()));
      await completeSignupProfile(name, workspaceName);
      router.push("/");
    } catch (err) {
      setError(mapOtpVerifyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const errorMessage = error?.message;

  if (signupMode === "email-code" && emailCodeStep === "code") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{errorMessage}</div>
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
              Name: <strong>{name}</strong>
              {workspaceName.trim() ? (
                <>
                  {" "}
                  • Workspace: <strong>{workspaceName.trim()}</strong>
                </>
              ) : null}
            </p>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || otpCode.trim().length !== 6}
            >
              {isLoading ? "Verifying..." : "Verify & Create Account"}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setError(null);
                  resetOtpState();
                }}
              >
                Back
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

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Opencom</CardTitle>
        <CardDescription>Create your account</CardDescription>
        {hasPassword && hasOtp ? (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              type="button"
              variant={signupMode === "password" ? "default" : "outline"}
              onClick={() => handleSwitchMode("password")}
            >
              Password
            </Button>
            <Button
              type="button"
              variant={signupMode === "email-code" ? "default" : "outline"}
              onClick={() => handleSwitchMode("email-code")}
            >
              Email Code
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <form
          onSubmit={signupMode === "password" ? handlePasswordSubmit : handleSendCode}
          className="space-y-4"
        >
          {errorMessage && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{errorMessage}</div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

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
            <label htmlFor="workspace-name" className="text-sm font-medium">
              Workspace name (optional)
            </label>
            <Input
              id="workspace-name"
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Acme Support"
            />
          </div>

          <div className="space-y-2">
            {signupMode === "password" ? (
              <>
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                We&apos;ll send a 6-digit verification code so you can create your account without a
                password.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {signupMode === "password"
              ? isLoading
                ? "Creating account..."
                : "Create Account"
              : isLoading
                ? "Sending..."
                : "Send verification code"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  const { activeBackend } = useBackend();

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
      <SignupForm />
    </div>
  );
}
