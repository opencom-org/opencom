import type { Metadata } from "next";
import "@opencom/ui/globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WidgetScript } from "@/components/widget-script";
import { landingRootMetadata } from "@/lib/metadata";

export const metadata: Metadata = landingRootMetadata;

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
