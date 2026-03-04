"use client";

import { motion } from "framer-motion";
import { CursorClick, X, Sparkle } from "@phosphor-icons/react";

export function ToursGraphic() {
  return (
    <div className="relative w-full h-full bg-muted/20 dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-8">
      {/* Background App Mockup */}
      <div className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none p-10 grid grid-cols-4 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="h-8 w-3/4 bg-border/50 rounded-lg" />
          <div className="space-y-2 mt-8">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-6 bg-border/30 rounded-md w-full" />
            ))}
          </div>
        </div>
        <div className="col-span-3 space-y-6">
          <div className="h-12 bg-border/40 rounded-xl w-full" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-border/30 rounded-xl w-full" />
            ))}
          </div>
          <div className="h-64 bg-border/30 rounded-xl w-full" />
        </div>
      </div>

      {/* Target Element being Highlighted */}
      <div className="relative z-10 p-6 rounded-2xl bg-card border-2 border-primary/40 shadow-[0_0_40px_-10px_rgba(var(--primary),0.3)] w-full max-w-sm ml-[-20%] mb-[10%]">
        <div className="absolute -inset-1 rounded-2xl border border-primary/20 animate-pulse" />
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-primary" />
        
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkle weight="duotone" className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="h-4 w-24 bg-foreground/80 rounded mb-2" />
            <div className="h-3 w-32 bg-muted-foreground/50 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full bg-muted rounded" />
          <div className="h-2 w-5/6 bg-muted rounded" />
        </div>
      </div>

      {/* The Tour Popover */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.3 }}
        className="absolute z-20 top-[45%] left-[55%] w-[320px] bg-foreground text-background rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Pointer Triangle */}
        <div className="absolute -left-3 top-12 w-0 h-0 border-t-[12px] border-t-transparent border-r-[16px] border-r-foreground border-b-[12px] border-b-transparent" />
        
        <div className="p-1 border-b border-background/10 flex items-center justify-between bg-white/5">
          <div className="px-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-background/60">Step 2 of 4</span>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-background/60" />
          </button>
        </div>
        
        <div className="p-6">
          <h4 className="text-lg font-bold mb-2">Configure AI Auto-Resolve</h4>
          <p className="text-sm text-background/80 leading-relaxed mb-6">
            Train your agent on your documentation. It will automatically resolve repetitive queries and escalate complex issues to your team.
          </p>
          
          <div className="flex items-center justify-between">
            <button className="text-sm font-medium text-background/60 hover:text-background transition-colors">
              Skip Tour
            </button>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                Back
              </button>
              <button className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg shadow-lg hover:opacity-90 transition-opacity">
                Next
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Mouse Cursor */}
      <motion.div
        initial={{ x: 100, y: 150, opacity: 0 }}
        animate={{ x: 10, y: 40, opacity: 1 }}
        transition={{ delay: 0.8, duration: 1.5, type: "spring", stiffness: 50 }}
        className="absolute z-30"
      >
        <CursorClick weight="fill" className="w-10 h-10 text-primary drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] -rotate-12" />
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 2], opacity: [0.8, 0] }}
          transition={{ delay: 2.2, duration: 0.5 }}
          className="absolute top-1 left-1 w-6 h-6 rounded-full bg-primary/40 -z-10"
        />
      </motion.div>
    </div>
  );
}
