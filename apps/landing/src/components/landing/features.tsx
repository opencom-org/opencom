"use client";

import { motion, Variants } from "framer-motion";
import {
  ChatsCircle,
  MapTrifold,
  Ticket,
  Robot,
  Megaphone,
  ChartLineUp,
} from "@phosphor-icons/react";

import { InboxGraphic } from "./graphics/inbox-graphic";
import { ToursGraphic } from "./graphics/tours-graphic";
import { TicketsGraphic } from "./graphics/tickets-graphic";
import { AIAgentGraphic } from "./graphics/ai-graphic";
import { CampaignsGraphic } from "./graphics/campaigns-graphic";
import { ReportsGraphic } from "./graphics/reports-graphic";

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

const features = [
  {
    title: "Shared Inbox",
    description:
      "Multi-channel support inbox tailored for modern teams. Route, assign, and resolve effortlessly.",
    icon: ChatsCircle,
    Graphic: InboxGraphic,
  },
  {
    title: "Product Tours",
    description:
      "Guide users through your app with native, beautiful onboarding tours that drive activation.",
    icon: MapTrifold,
    Graphic: ToursGraphic,
  },
  {
    title: "Support Tickets",
    description:
      "Track complex issues alongside real-time chat. Seamlessly convert conversations to tickets.",
    icon: Ticket,
    Graphic: TicketsGraphic,
  },
  {
    title: "AI Agent",
    description:
      "Deploy an intelligent agent trained on your docs to instantly resolve common queries 24/7.",
    icon: Robot,
    Graphic: AIAgentGraphic,
  },
  {
    title: "Outbound Campaigns",
    description:
      "Trigger targeted in-app messages and emails based on user behavior and segment rules.",
    icon: Megaphone,
    Graphic: CampaignsGraphic,
  },
  {
    title: "Analytics",
    description:
      "Deep insights into team performance, resolution times, and customer satisfaction metrics.",
    icon: ChartLineUp,
    Graphic: ReportsGraphic,
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
                  <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] pointer-events-none z-10" />
                  
                  {/* Full bleed graphic */}
                  <div className="absolute inset-[2px] rounded-[2.4rem] overflow-hidden bg-muted/10">
                    <feature.Graphic />
                  </div>
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
