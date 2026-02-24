"use client";

import { motion, Variants } from "framer-motion";
import { memo } from "react";
import {
  ChatsCircle,
  MapTrifold,
  Ticket,
  Robot,
  Megaphone,
  ChartLineUp,
} from "@phosphor-icons/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 20 } },
};

// Perpetual Micro-Interaction for Icon Cards
const PerpetualIcon = memo(function PerpetualIcon({
  icon: Icon,
  delay = 0,
}: {
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div
      animate={{
        y: [0, -8, 0],
        scale: [1, 1.05, 1],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-transparent"
    >
      <div className="absolute inset-0 rounded-full border border-primary/20 blur-sm" />
      <Icon weight="duotone" className="w-10 h-10 text-primary" />
    </motion.div>
  );
});

const features = [
  {
    title: "Shared Inbox",
    description:
      "Multi-channel support inbox tailored for modern teams. Route, assign, and resolve effortlessly.",
    icon: ChatsCircle,
  },
  {
    title: "Product Tours",
    description:
      "Guide users through your app with native, beautiful onboarding tours that drive activation.",
    icon: MapTrifold,
  },
  {
    title: "Support Tickets",
    description:
      "Track complex issues alongside real-time chat. Seamlessly convert conversations to tickets.",
    icon: Ticket,
  },
  {
    title: "AI Agent",
    description:
      "Deploy an intelligent agent trained on your docs to instantly resolve common queries 24/7.",
    icon: Robot,
  },
  {
    title: "Outbound Campaigns",
    description:
      "Trigger targeted in-app messages and emails based on user behavior and segment rules.",
    icon: Megaphone,
  },
  {
    title: "Analytics",
    description:
      "Deep insights into team performance, resolution times, and customer satisfaction metrics.",
    icon: ChartLineUp,
  },
];

export function Features() {
  return (
    <section
      data-tour-target="features-section"
      className="py-32 lg:py-40 bg-[#f9fafb] dark:bg-background border-t border-border/40"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="max-w-3xl mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-border bg-white dark:bg-card shadow-sm"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              The Complete Toolkit
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold tracking-tighter text-foreground mb-6"
          >
            Everything you need. <br className="hidden sm:block" />
            <span className="text-muted-foreground">Nothing you don&apos;t.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground leading-relaxed"
          >
            A cohesive suite of customer messaging tools, engineered for speed and designed for
            modern workflows. Built on a single real-time engine.
          </motion.p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16"
        >
          {features.map((feature, i) => {
            return (
              <motion.div key={i} variants={item} className="group flex flex-col">
                {/* Bento Container */}
                <div className="relative w-full aspect-[4/3] rounded-[2.5rem] bg-white dark:bg-card border border-slate-200/50 dark:border-white/5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] mb-8 overflow-hidden flex items-center justify-center transition-transform duration-500 hover:scale-[1.02]">
                  {/* Subtle inner glow */}
                  <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] pointer-events-none" />

                  {/* Abstract background blobs */}
                  <div className="absolute inset-0 opacity-20 dark:opacity-10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/30 blur-[40px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/20 blur-[40px] rounded-full" />
                  </div>

                  <PerpetualIcon icon={feature.icon} delay={i * 0.2} />
                </div>

                {/* External Labels (Gallery Style) */}
                <div className="px-2">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-bold tracking-tight text-foreground">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
