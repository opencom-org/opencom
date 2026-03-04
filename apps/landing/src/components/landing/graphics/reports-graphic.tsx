"use client";

import { motion } from "framer-motion";
import { ChartLineUp, Users, Clock, TrendUp } from "@phosphor-icons/react";

export function ReportsGraphic() {
  return (
    <div className="relative w-full h-full bg-muted/10 dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-6">
      {/* Dashboard Mockup */}
      <div className="w-full h-full max-w-lg bg-card rounded-2xl border border-border/50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/20">
          <div className="flex items-center gap-2">
            <ChartLineUp weight="bold" className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Analytics Overview</span>
          </div>
          <div className="px-2 py-1 rounded bg-background border border-border/50 text-[10px] font-medium text-muted-foreground">
            Last 30 Days
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col gap-4">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-background border border-border/50 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Total Convos</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-black">1,248</span>
                <span className="flex items-center text-xs font-bold text-green-500 mb-1 bg-green-500/10 px-1 rounded">
                  <TrendUp weight="bold" className="mr-0.5" /> 12%
                </span>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-background border border-border/50 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Median Response</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-black">4m</span>
                <span className="flex items-center text-xs font-bold text-green-500 mb-1 bg-green-500/10 px-1 rounded">
                  <TrendUp weight="bold" className="mr-0.5" /> 8%
                </span>
              </div>
            </motion.div>
          </div>

          {/* Main Chart Area */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex-1 bg-background border border-border/50 rounded-xl p-4 relative overflow-hidden flex flex-col"
          >
            <span className="text-xs font-medium text-muted-foreground mb-4 block">Volume over time</span>
            
            {/* SVG Line Chart Animation */}
            <div className="flex-1 relative w-full mt-2">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-full h-px bg-border/40" />
                ))}
              </div>
              
              {/* Animated Path */}
              <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                <motion.path 
                  d="M0,80 Q10,70 20,80 T40,60 T60,40 T80,50 T100,20" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3"
                  className="text-primary"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
                />
                {/* Area under the curve */}
                <motion.path 
                  d="M0,80 Q10,70 20,80 T40,60 T60,40 T80,50 T100,20 L100,100 L0,100 Z" 
                  fill="url(#gradient)" 
                  className="opacity-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.2 }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" className="text-primary" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
