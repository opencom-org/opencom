"use client";

import { motion } from "framer-motion";
import { Robot, Sparkle, ChatCircle, Books } from "@phosphor-icons/react";

export function AIAgentGraphic() {
  return (
    <div className="relative w-full h-full bg-muted/10 dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-8">
      {/* Background Data Nodes */}
      <div className="absolute inset-0 opacity-20 pointer-events-none p-6 flex flex-wrap gap-4 items-center justify-center">
        {[...Array(12)].map((_, i) => (
          <motion.div 
            key={i}
            animate={{ 
              y: [0, Math.random() * 10 - 5, 0],
              opacity: [0.3, 0.7, 0.3]
            }}
            transition={{ 
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
            className="w-12 h-8 rounded-md bg-border border border-border/50 flex items-center justify-center"
          >
            <div className="w-6 h-1 rounded-full bg-muted-foreground/30" />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Connection Lines */}
        <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 -z-10 opacity-30" viewBox="0 0 100 100">
          <motion.path 
            d="M50,50 L20,20 M50,50 L80,20 M50,50 L20,80 M50,50 L80,80" 
            stroke="currentColor" 
            strokeWidth="1"
            className="text-primary"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
          />
        </svg>

        {/* Central Brain/Agent */}
        <motion.div 
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-[2px] shadow-2xl shadow-primary/30 mb-8 relative"
        >
          <div className="absolute -inset-4 bg-primary/20 blur-xl rounded-full" />
          <div className="w-full h-full bg-card rounded-2xl flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/10" />
            <Robot weight="duotone" className="w-12 h-12 text-primary relative z-10" />
            <Sparkle weight="fill" className="absolute top-3 right-3 w-4 h-4 text-primary animate-pulse" />
          </div>
        </motion.div>

        {/* Agent Output Simulation */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="p-3 border-b border-border/50 bg-muted/20 flex items-center gap-2">
            <ChatCircle weight="fill" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold">User: How do I setup SSO?</span>
          </div>
          <div className="p-4 bg-background">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                <Robot weight="fill" className="w-3 h-3 text-primary" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-full bg-primary/20 rounded" />
                </div>
                <div className="h-2 w-5/6 bg-muted-foreground/20 rounded" />
                <div className="h-2 w-4/6 bg-muted-foreground/20 rounded" />
                
                {/* Source Citation */}
                <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 border border-border/50">
                  <Books weight="duotone" className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[9px] font-mono text-muted-foreground">docs/sso-setup.md</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
