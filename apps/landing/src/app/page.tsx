import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Showcase } from "@/components/landing/showcase";
import { CTA } from "@/components/landing/cta";
import { createLandingPageMetadata } from "@/lib/metadata";

export const metadata = createLandingPageMetadata({
  title: "Opencom — The Open-Source Customer Messaging Engine",
  description:
    "Self-host live chat, product tours, tickets, and AI agents without the vendor lock-in.",
  path: "/",
});

export default function Home() {
  return (
    <main>
      <Hero />
      <Features />
      <Showcase />
      <CTA />
    </main>
  );
}
