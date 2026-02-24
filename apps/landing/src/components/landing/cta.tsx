"use client";

import { motion } from "framer-motion";
import { ArrowRight, GithubLogo, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";
import { OPENCOM_HOSTED_ONBOARDING_URL, OPENCOM_GITHUB_DOCS_URL } from "@/lib/links";

export function CTA() {
  return (
    <section
      data-tour-target="final-cta-section"
      className="relative py-40 overflow-hidden border-t border-border/40 bg-[#f9fafb] dark:bg-background"
    >
      {/* Mesh Gradient Background / Lava-lamp blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1000px] aspect-square pointer-events-none opacity-50 dark:opacity-30 mix-blend-multiply dark:mix-blend-screen">
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-primary/30 to-violet-500/30 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            rotate: -360,
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute inset-10 bg-gradient-to-l from-blue-500/30 to-primary/30 blur-[120px] rounded-full"
        />
      </div>

      {/* Noise overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="bg-white dark:bg-card border border-slate-200/50 dark:border-white/5 rounded-[3rem] p-12 md:p-20 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] flex flex-col items-center w-full max-w-4xl"
        >
          <div className="mb-8 flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
            <Sparkle weight="fill" className="w-8 h-8" />
          </div>

          <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-8 text-foreground leading-[1.05]">
            Start building <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-500">
              without boundaries.
            </span>
          </h2>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-[40ch] mb-12">
            Deploy your own high-performance customer messaging stack today. Zero lock-in, infinite
            customization.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-5 w-full sm:w-auto">
            <Link
              href={OPENCOM_HOSTED_ONBOARDING_URL}
              data-tour-target="final-cta-primary"
              className="group relative flex h-14 w-full sm:w-auto items-center justify-center gap-3 overflow-hidden rounded-2xl bg-primary px-10 font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-primary/20"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Hosted Demo{" "}
                <ArrowRight
                  weight="bold"
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
              <div className="absolute inset-0 z-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
            </Link>

            <Link
              href={OPENCOM_GITHUB_DOCS_URL}
              target="_blank"
              className="group flex h-14 w-full sm:w-auto items-center justify-center gap-3 rounded-2xl border border-border/80 bg-white dark:bg-background px-10 font-semibold text-foreground transition-all hover:bg-muted/50 hover:border-border hover:scale-105 active:scale-95 shadow-sm"
            >
              <GithubLogo
                weight="fill"
                className="h-6 w-6 text-foreground/70 group-hover:text-foreground transition-colors"
              />
              View Repository
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
