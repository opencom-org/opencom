"use client";

import { motion, Variants, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  GithubLogo,
  ChatCircle,
  Lightning,
  PaperPlaneRight,
  User,
  Hash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useEffect, memo } from "react";
import { OPENCOM_HOSTED_ONBOARDING_URL, OPENCOM_GITHUB_DOCS_URL } from "@/lib/links";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

// Perpetual Motion Micro-interaction: The Intelligent List
const IntelligentList = memo(function IntelligentList() {
  const [tasks, setTasks] = useState([
    { id: 1, user: "Alex M.", text: "Pricing question", time: "1m ago", active: true },
    { id: 2, user: "Sarah K.", text: "Feature request", time: "5m ago", active: false },
    { id: 3, user: "David R.", text: "Bug report", time: "12m ago", active: false },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prev) => {
        const next = [...prev];
        const first = next.shift()!;
        next.push(first);
        return next.map((t, i) => ({ ...t, active: i === 0 }));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full flex flex-col gap-3 p-2">
      <div className="flex items-center gap-2 mb-2 px-2">
        <Hash className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Live Inbox
        </span>
      </div>
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => (
          <motion.div
            layout
            layoutId={`task-${task.id}`}
            key={task.id}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: task.active ? 1.02 : 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className={`flex items-center justify-between p-4 rounded-2xl border ${
              task.active
                ? "bg-primary text-primary-foreground border-primary shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5)]"
                : "bg-card text-foreground border-border/50 shadow-sm"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${task.active ? "bg-white/20" : "bg-muted"}`}
              >
                <User className="w-4 h-4" weight={task.active ? "fill" : "regular"} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{task.user}</span>
                <span
                  className={`text-xs ${task.active ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                >
                  {task.text}
                </span>
              </div>
            </div>
            <div
              className={`text-[10px] font-medium ${task.active ? "text-primary-foreground/90" : "text-muted-foreground"}`}
            >
              {task.time}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

// Perpetual Motion Micro-interaction: The Command Input
const CommandInput = memo(function CommandInput() {
  const [step, setStep] = useState(0);
  const steps = [
    { text: "Ask AI Agent: How do I upgrade my plan?", icon: ChatCircle },
    { text: "Processing intention...", icon: Lightning, active: true },
    { text: "Drafting response with pricing docs...", icon: PaperPlaneRight },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-card border border-border/50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] p-6 mt-6">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="flex items-center gap-4">
        <motion.div
          key={step}
          initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 15 }}
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${steps[step].active ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground"}`}
        >
          {(() => {
            const Icon = steps[step].icon;
            return <Icon className="w-5 h-5" weight={steps[step].active ? "fill" : "duotone"} />;
          })()}
        </motion.div>
        <div className="flex-1">
          <motion.div
            key={step + "text"}
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm font-medium text-foreground"
          >
            {steps[step].text}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-1.5 h-4 ml-1 bg-primary align-middle"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
});

export function Hero() {
  return (
    <section
      data-tour-target="hero-section"
      className="relative min-h-[calc(100dvh-4.5rem)] w-full overflow-hidden bg-[#f9fafb] dark:bg-background flex items-center py-12 lg:py-0"
    >
      {/* Abstract Noise/Grain Background */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <div className="mx-auto max-w-[1400px] w-full px-6 lg:px-12 z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left Column: Typography */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col items-start justify-center text-left max-w-2xl"
        >
          <motion.div
            variants={item}
            className="mb-8 flex items-center gap-3 rounded-full border border-border/60 bg-white/50 dark:bg-muted/20 px-5 py-2 backdrop-blur-md shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground/80">
              Open Source Customer Messaging
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="text-5xl md:text-7xl lg:text-[5rem] font-bold tracking-tighter leading-[1.05] text-foreground mb-8"
          >
            Own your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
              customer engine.
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="text-xl text-muted-foreground leading-relaxed max-w-[45ch] mb-12"
          >
            The open-source alternative to Intercom. Self-hosted live chat, product tours, tickets,
            and AI agents—built for high-velocity teams.
          </motion.p>

          <motion.div
            variants={item}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Link
              href={OPENCOM_HOSTED_ONBOARDING_URL}
              data-tour-target="hero-primary-cta"
              className="group relative flex h-14 w-full sm:w-auto items-center justify-center gap-3 overflow-hidden rounded-2xl bg-foreground px-10 font-semibold text-background transition-transform active:scale-[0.98] shadow-lg"
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
              data-tour-target="hero-github-docs"
              className="group flex h-14 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-border/80 bg-white dark:bg-card px-10 font-semibold text-foreground transition-all hover:bg-muted/50 hover:border-border active:scale-[0.98] shadow-sm"
            >
              <GithubLogo
                weight="fill"
                className="h-5 w-5 text-foreground/70 group-hover:text-foreground transition-colors"
              />
              GitHub Docs
            </Link>
          </motion.div>
        </motion.div>

        {/* Right Column: Motion Engine Bento Layout */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.2 }}
          className="relative w-full flex flex-col items-center justify-center"
        >
          {/* Diffusion Shadow Backdrop */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/10 dark:bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

          {/* Bento Cluster Container */}
          <div className="relative w-full max-w-md mx-auto z-10">
            {/* The Intelligent List Card */}
            <div className="rounded-[2.5rem] bg-white/80 dark:bg-card/80 backdrop-blur-2xl border border-white dark:border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] p-6">
              <IntelligentList />
            </div>

            {/* The Command Input Card */}
            <div className="relative z-20 -mt-8 ml-8 mr-[-2rem]">
              <CommandInput />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
