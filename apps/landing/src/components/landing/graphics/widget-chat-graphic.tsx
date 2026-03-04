"use client";

import { motion } from "framer-motion";
import { PaperPlaneRight, Robot, CaretLeft, Sparkle, Images } from "@phosphor-icons/react";

export function WidgetChatGraphic() {
  return (
    <div className="relative w-full h-full bg-muted/10 dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-6">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="w-full max-w-[320px] h-[400px] bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden flex flex-col"
      >
        {/* Chat Header */}
        <div className="bg-background border-b border-border/50 p-4 flex items-center gap-3">
          <button className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-foreground hover:bg-muted transition-colors">
            <CaretLeft weight="bold" className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Robot weight="fill" className="w-4 h-4 text-primary" />
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">AI Assistant</h3>
              <p className="text-[10px] text-muted-foreground">Typically replies instantly</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 bg-muted/10 overflow-hidden relative flex flex-col gap-4">
          <div className="text-center">
            <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              Today 10:42 AM
            </span>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-end gap-1"
          >
            <div className="bg-primary text-primary-foreground p-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-sm">
              How do I configure custom domains?
            </div>
            <span className="text-[9px] text-muted-foreground pr-1">Read</span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="flex items-end gap-2"
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mb-1">
              <Robot weight="fill" className="w-3 h-3 text-primary" />
            </div>
            <div className="bg-background border border-border/50 p-3 rounded-2xl rounded-tl-sm max-w-[85%] text-sm text-foreground shadow-sm space-y-2">
              <p>You can set up a custom domain in your workspace settings.</p>
              <div className="p-2 bg-muted/50 rounded-lg border border-border/30">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkle weight="fill" className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-bold text-foreground">Steps:</span>
                </div>
                <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
                  <li>Go to Settings &gt; Domains</li>
                  <li>Click &quot;Add Domain&quot;</li>
                  <li>Configure your DNS records</li>
                </ol>
              </div>
            </div>
          </motion.div>

          {/* Typing Indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="flex items-end gap-2 absolute bottom-4 left-4"
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Robot weight="fill" className="w-3 h-3 text-primary" />
            </div>
            <div className="bg-background border border-border/50 py-2 px-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full" />
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full" />
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full" />
            </div>
          </motion.div>
        </div>

        {/* Composer */}
        <div className="p-3 bg-background border-t border-border/50">
          <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-full px-4 py-2 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
            <input 
              type="text" 
              placeholder="Reply..." 
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              readOnly
            />
            <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <Images weight="bold" className="w-4 h-4" />
            </button>
            <button className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-sm ml-1 hover:opacity-90 transition-opacity">
              <PaperPlaneRight weight="fill" className="w-3 h-3 -ml-0.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
