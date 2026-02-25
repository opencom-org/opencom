"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@opencom/ui";
import { MessageSquare, Users, BookOpen, Sparkles } from "lucide-react";
import { useAuthOptional } from "@/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const auth = useAuthOptional();
  const defaultHomePath = auth?.defaultHomePath ?? "/inbox";
  const isHomeRouteLoading = auth?.isHomeRouteLoading ?? false;

  useEffect(() => {
    if (auth && !auth.isLoading && auth.user && !isHomeRouteLoading) {
      router.replace(defaultHomePath);
    }
  }, [auth, defaultHomePath, isHomeRouteLoading, router]);

  // Show loading while checking auth and default destination.
  if (auth?.isLoading || (auth?.user && isHomeRouteLoading)) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  // If logged in, show nothing while redirecting
  if (auth?.user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to Opencom</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Open-source customer messaging platform. Chat with your customers, create product tours,
            and build a knowledge base.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Chat</CardTitle>
              <CardDescription>Real-time messaging with your customers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Engage with visitors and customers through a beautiful chat widget.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Sparkles className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Product Tours</CardTitle>
              <CardDescription>Guide users through your product</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create interactive tours with our WYSIWYG editor.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BookOpen className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>Self-service help center</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Help customers find answers on their own.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Mobile Apps</CardTitle>
              <CardDescription>Android available, iOS coming soon</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get push notifications in the Android inbox app and stay responsive while away from
                desktop.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Link href="/login">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
