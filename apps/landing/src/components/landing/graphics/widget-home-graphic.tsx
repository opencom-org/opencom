"use client";

import { motion } from "framer-motion";
import { House, Chats, Robot, BookOpenText, Megaphone, CaretRight } from "@phosphor-icons/react";

export function WidgetHomeGraphic() {
  return (
    <div className="relative w-full h-full bg-muted/10 dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-6">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="w-full max-w-[320px] bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden flex flex-col"
      >
        {/* Widget Header */}
        <div className="bg-primary p-5 text-primary-foreground">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <div className="w-5 h-5 rounded-full bg-white" />
              </div>
              <h3 className="text-lg font-bold">Hi there 👋</h3>
              <p className="text-sm text-primary-foreground/80">How can we help today?</p>
            </div>
          </div>
        </div>

        {/* Widget Body */}
        <div className="p-4 space-y-4 bg-muted/20 flex-1">
          {/* Recent Conversation */}
          <div className="bg-background rounded-2xl p-4 shadow-sm border border-border/50 cursor-pointer hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground">Recent conversation</span>
              <CaretRight className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">S</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Yes, the Pro plan includes that.</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Active 2h ago</p>
              </div>
            </div>
          </div>

          {/* Start New Action */}
          <button className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Chats weight="fill" className="w-4 h-4" />
            Send us a message
          </button>

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-2 hover:border-primary/40 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <BookOpenText weight="fill" className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-semibold">Help Center</span>
            </div>
            <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-2 hover:border-primary/40 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Robot weight="fill" className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-semibold">Ask AI Agent</span>
            </div>
          </div>
        </div>

        {/* Widget Tab Bar */}
        <div className="h-14 bg-background border-t border-border/50 flex items-center justify-between px-6">
          <div className="flex flex-col items-center text-primary">
            <House weight="fill" className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-medium">Home</span>
          </div>
          <div className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors">
            <Chats weight="regular" className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-medium">Messages</span>
          </div>
          <div className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors">
            <BookOpenText weight="regular" className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-medium">Help</span>
          </div>
          <div className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors relative">
            <Megaphone weight="regular" className="w-5 h-5 mb-0.5" />
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 border-2 border-background" />
            <span className="text-[9px] font-medium">News</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
