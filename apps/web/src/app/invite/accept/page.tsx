"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@opencom/ui";
import { Mail, ArrowRight } from "lucide-react";

export default function InviteAcceptPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">You&apos;ve been invited!</CardTitle>
          <CardDescription>
            {email ? (
              <>
                Create an account with <strong>{email}</strong> to accept the invitation
              </>
            ) : (
              <>Create an account to accept the invitation</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Sign up or sign in to join the workspace. Your invitation will be automatically
            accepted.
          </p>

          <div className="space-y-2">
            <Link href={email ? `/signup?email=${encodeURIComponent(email)}` : "/signup"}>
              <Button className="w-full">
                Create Account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>

            <Link href="/login">
              <Button variant="outline" className="w-full">
                Already have an account? Sign in
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
