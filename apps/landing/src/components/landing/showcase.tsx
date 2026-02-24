"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

const showcaseItems = [
  {
    title: "High-performance Inbox",
    description:
      "Keyboard-first navigation, real-time sync, and intelligent routing. Built to handle scale without breaking a sweat.",
    image: "/screenshots/web-inbox.png",
    tourTarget: "showcase-inbox",
  },
  {
    title: "Native Product Tours",
    description:
      "Design multi-step interactive tours directly within your app. No fragile CSS selectors or third-party iframe overlays.",
    image: "/screenshots/widget-tour-post-step.png",
    tourTarget: "showcase-product-tour",
  },
];

export function Showcase() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={containerRef}
      data-tour-target="showcase-section"
      className="overflow-x-hidden py-32 lg:py-40 bg-white dark:bg-muted/10 border-t border-border/40"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 flex flex-col gap-40">
        {showcaseItems.map((item, index) => {
          const isEven = index % 2 === 0;
          return (
            <div
              key={index}
              data-tour-target={item.tourTarget}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center"
            >
              <motion.div
                initial={{ opacity: 0, x: isEven ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ type: "spring", stiffness: 80, damping: 20 }}
                className={`flex flex-col lg:col-span-5 ${isEven ? "lg:order-1" : "lg:order-2"}`}
              >
                <div className="inline-flex items-center gap-2 mb-8">
                  <span className="w-8 h-px bg-primary" />
                  <span className="text-sm font-bold uppercase tracking-widest text-primary">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6 text-foreground leading-[1.1]">
                  {item.title}
                </h3>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-[40ch]">
                  {item.description}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 40 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ type: "spring", stiffness: 80, damping: 20 }}
                className={`relative w-full lg:col-span-7 ${isEven ? "lg:order-2" : "lg:order-1"}`}
              >
                {/* 3D Container effect via pure CSS and subtle rotation */}
                <div className="group relative rounded-[2.5rem] bg-[#f9fafb] dark:bg-card border border-slate-200/50 dark:border-white/5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] p-2 transition-transform duration-700 ease-out hover:scale-[1.01] hover:-rotate-1">
                  {/* Subtle inner glow */}
                  <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] pointer-events-none" />

                  <div className="rounded-[2rem] overflow-hidden border border-border/50 bg-muted/20 dark:bg-black relative">
                    <div className="flex items-center px-5 py-4 border-b border-border/50 bg-white/50 dark:bg-muted/10 backdrop-blur-md">
                      <div className="flex gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                      </div>
                    </div>
                    <div className="relative aspect-[16/10] w-full bg-background dark:bg-black overflow-hidden">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        className="w-full h-full"
                      >
                        <Image src={item.image} alt={item.title} fill className="object-cover" />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
