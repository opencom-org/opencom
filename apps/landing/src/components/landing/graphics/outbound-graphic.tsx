"use client";

import { motion } from "framer-motion";
import { PaperPlaneRight, Sparkle } from "@phosphor-icons/react";

export function OutboundGraphic() {
  return (
    <div className="relative w-full h-full bg-muted/10 dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-8">
      {/* Background Pulse */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-96 h-96 bg-primary/20 rounded-full blur-[80px]"
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Campaign Builder Card */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden mb-6"
        >
          <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <PaperPlaneRight weight="fill" className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">New Feature Announcement</h4>
              <p className="text-[10px] text-muted-foreground">Target: Active Users (Last 30d)</p>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-muted-foreground">Delivery Method</span>
                <span className="text-primary font-semibold">In-app Chat</span>
              </div>
              <div className="h-10 rounded-lg border border-border/50 bg-background flex items-center px-3">
                <div className="h-2 w-32 bg-muted rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Message Content</span>
              <div className="h-24 rounded-lg border border-border/50 bg-background p-3 space-y-2">
                <div className="h-2 w-full bg-muted rounded" />
                <div className="h-2 w-5/6 bg-muted rounded" />
                <div className="h-2 w-4/6 bg-muted rounded" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Floating AI Suggestion */}
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 20, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="absolute -right-8 top-1/2 bg-background border border-primary/30 rounded-xl p-3 shadow-lg flex items-start gap-3 w-64"
        >
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkle weight="fill" className="w-3 h-3 text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-foreground/90 leading-relaxed">
              Based on recent usage, sending this on <strong>Tuesday at 10 AM</strong> will increase open rates by 24%.
            </p>
            <button className="mt-2 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors">
              Apply Suggestion
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
