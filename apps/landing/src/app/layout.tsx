import type { Metadata } from "next";
import "@opencom/ui/globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WidgetScript } from "@/components/widget-script";

export const metadata: Metadata = {
  title: "Opencom - Open Source Customer Messaging",
  description:
    "The open-source Intercom alternative. Self-hosted customer messaging with live chat, product tours, tickets, surveys, campaigns, knowledge base, AI agent, and native SDKs.",
  keywords: [
    "open source",
    "intercom alternative",
    "customer messaging",
    "chat widget",
    "self-hosted",
    "product tours",
    "knowledge base",
    "support tickets",
    "surveys",
    "campaigns",
    "ai agent",
    "customer support",
  ],
  authors: [{ name: "Opencom Team" }],
  openGraph: {
    title: "Opencom - Open Source Customer Messaging",
    description:
      "The open-source Intercom alternative. Self-hosted customer messaging with live chat, tours, tickets, surveys, campaigns, and AI agent.",
    url: "https://opencom.dev",
    siteName: "Opencom",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Opencom - Open Source Customer Messaging",
    description:
      "The open-source Intercom alternative. Self-hosted customer messaging with live chat, tours, tickets, surveys, campaigns, and AI agent.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVariables = {
    "--font-geist-sans": '"Inter", "Inter Fallback", "Segoe UI", sans-serif',
    "--font-geist-mono": '"JetBrains Mono", "SFMono-Regular", ui-monospace, monospace',
  } as React.CSSProperties;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap"
        />
      </head>
      <body className="antialiased font-sans" style={fontVariables}>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <WidgetScript />
      </body>
    </html>
  );
}
