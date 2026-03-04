"use client";

import { motion } from "framer-motion";
import { EnvelopeSimple, RocketLaunch, CursorClick } from "@phosphor-icons/react";

export function CampaignsGraphic() {
  return (
    <div className="relative w-full h-full bg-background dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-8">
      {/* Background Pipeline Graph */}
      <div className="absolute inset-0 opacity-10 pointer-events-none p-10 flex flex-col justify-between">
        <div className="w-full h-px bg-primary/50 relative">
          <div className="absolute top-1/2 left-1/4 w-3 h-3 -translate-y-1/2 rounded-full bg-primary" />
          <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-y-1/2 rounded-full bg-primary" />
          <div className="absolute top-1/2 right-1/4 w-3 h-3 -translate-y-1/2 rounded-full bg-primary" />
        </div>
        <div className="w-full h-px bg-primary/50 relative">
          <div className="absolute top-1/2 left-1/3 w-3 h-3 -translate-y-1/2 rounded-full bg-primary" />
          <div className="absolute top-1/2 right-1/3 w-3 h-3 -translate-y-1/2 rounded-full bg-primary" />
        </div>
        <div className="w-full h-px bg-primary/50 relative">
          <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-y-1/2 rounded-full bg-primary" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col gap-4">
        {/* Campaign Analytics Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <RocketLaunch weight="duotone" className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Black Friday Promo</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Active (Sending)</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-foreground">42%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Open Rate</div>
          </div>
        </motion.div>

        {/* Campaign Steps */}
        <div className="flex flex-col gap-2 pl-6 relative">
          <div className="absolute left-[39px] top-4 bottom-4 w-0.5 bg-border/50" />
          
          {[
            { type: "Email", icon: EnvelopeSimple, label: "Initial Offer", delay: 0.2, active: false },
            { type: "Wait", icon: null, label: "Wait 2 days", delay: 0.4, active: false, small: true },
            { type: "In-App", icon: CursorClick, label: "Reminder Banner", delay: 0.6, active: true },
          ].map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: step.delay }}
              className={`flex items-center gap-4 ${step.small ? 'opacity-60 scale-90 py-1' : 'bg-background border border-border/50 rounded-xl p-3 shadow-sm'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 ${step.active ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : 'bg-muted text-muted-foreground'}`}>
                {step.icon ? <step.icon weight={step.active ? "fill" : "regular"} className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current" />}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground/80 uppercase tracking-wide mb-0.5">{step.type}</div>
                <div className="text-sm font-medium">{step.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
