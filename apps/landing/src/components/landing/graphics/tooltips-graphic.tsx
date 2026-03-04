"use client";

import { motion } from "framer-motion";
import { CursorClick, Info, CaretUp } from "@phosphor-icons/react";

export function TooltipsGraphic() {
  return (
    <div className="relative w-full h-full bg-muted/10 dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-8">
      {/* Background Dashboard Mockup */}
      <div className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none p-8 flex flex-col gap-6">
        <div className="flex justify-between items-center pb-4 border-b border-border/50">
          <div className="h-6 w-32 bg-border/40 rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-border/30 rounded-full" />
            <div className="h-8 w-24 bg-border/30 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 w-full bg-border/30 rounded-lg" />
            ))}
          </div>
          <div className="col-span-3 space-y-4">
            <div className="h-32 w-full bg-border/20 rounded-xl" />
            
            {/* The Target Element */}
            <div className="relative w-max">
              <div className="h-12 w-48 bg-border/50 rounded-lg flex items-center px-4 relative z-10">
                <div className="w-4 h-4 rounded-full bg-foreground/20 mr-3" />
                <div className="h-3 w-20 bg-foreground/30 rounded" />
              </div>
              
              {/* Highlight Ring */}
              <motion.div 
                animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -inset-1.5 border-2 border-primary/40 rounded-xl pointer-events-none z-20"
              />

              {/* Tooltip Badge */}
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.5 }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg z-30"
              >
                <Info weight="bold" className="w-3 h-3" />
              </motion.div>

              {/* The Tooltip Popover */}
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", delay: 1.2 }}
                className="absolute top-[calc(100%+12px)] left-0 w-64 bg-foreground text-background rounded-xl p-4 shadow-2xl z-40"
              >
                <div className="absolute -top-2 left-6 text-foreground">
                  <CaretUp weight="fill" className="w-6 h-6 -mt-1.5" />
                </div>
                <h4 className="text-sm font-bold mb-1.5">Configure API Keys</h4>
                <p className="text-xs text-background/80 leading-relaxed mb-3">
                  Generate your public and secret keys here to authenticate your backend requests.
                </p>
                <button className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors">
                  Read Documentation
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Cursor Interaction */}
      <motion.div
        initial={{ x: 150, y: 150, opacity: 0 }}
        animate={{ x: -20, y: 40, opacity: 1 }}
        transition={{ delay: 0.8, duration: 1.5, type: "spring" }}
        className="absolute z-50"
      >
        <CursorClick weight="fill" className="w-8 h-8 text-primary drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] -rotate-12" />
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 2], opacity: [0.8, 0] }}
          transition={{ delay: 2.3, duration: 0.5 }}
          className="absolute top-0 left-0 w-5 h-5 rounded-full bg-primary/40 -z-10"
        />
      </motion.div>
    </div>
  );
}
