"use client";

import { motion } from "framer-motion";
import { User, PaperPlaneRight, DotsThree, CheckCircle, Clock, MagnifyingGlass } from "@phosphor-icons/react";

export function InboxGraphic() {
  return (
    <div className="relative w-full h-full bg-background dark:bg-[#0a0a0a] overflow-hidden flex font-sans">
      {/* Sidebar */}
      <div className="w-[35%] h-full border-r border-border/50 bg-muted/10 flex flex-col">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2 bg-background dark:bg-muted/20 border border-border/50 rounded-xl px-3 py-2">
            <MagnifyingGlass className="w-4 h-4 text-muted-foreground" />
            <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-2 space-y-1">
          {/* Active Conversation */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 relative overflow-hidden group">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User weight="fill" className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-foreground truncate">Sarah Jenkins</span>
                <span className="text-[10px] font-medium text-primary">Just now</span>
              </div>
              <p className="text-xs text-primary/80 truncate">How do I upgrade my billing plan?</p>
            </div>
          </div>

          {/* Other Conversations */}
          {[
            { name: "Michael Chen", time: "5m", preview: "The API is throwing a 500 error", status: "open" },
            { name: "Emily Davis", time: "1h", preview: "Thanks! That fixed my issue.", status: "resolved" },
            { name: "Alex Kumar", time: "2h", preview: "Can we get a demo for our team?", status: "open" },
          ].map((chat, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User weight="duotone" className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-foreground/80 truncate">{chat.name}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">{chat.time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{chat.preview}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 h-full flex flex-col relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        {/* Chat Header */}
        <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-background/50 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User weight="fill" className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Sarah Jenkins</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] text-muted-foreground font-medium">Online • sarah@acmecorp.com</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-card text-xs font-medium text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Snooze
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium border border-green-500/20">
              <CheckCircle weight="fill" className="w-3.5 h-3.5" />
              Resolve
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/50 text-muted-foreground ml-1">
              <DotsThree weight="bold" className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-6 space-y-6 overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 px-3 py-1 rounded-b-lg bg-muted/30 border border-t-0 border-border/50 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            Today, 10:42 AM
          </div>
          
          <div className="flex items-start gap-3 mt-4">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
              <User weight="duotone" className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="bg-muted/40 border border-border/50 rounded-2xl rounded-tl-sm p-4 max-w-[80%] shadow-sm">
              <p className="text-sm text-foreground/90 leading-relaxed">
                Hi there! We are currently on the Pro plan but we need to add 5 more team members. How do I upgrade my billing plan to Enterprise?
              </p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex items-start gap-3 flex-row-reverse"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1 shadow-md shadow-primary/20">
              <span className="text-xs font-bold text-primary-foreground">Me</span>
            </div>
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm p-4 max-w-[80%] shadow-md shadow-primary/10">
              <p className="text-sm leading-relaxed">
                Hey Sarah! Happy to help with that. You can upgrade directly from your workspace settings.
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2, duration: 0.4 }}
            className="flex items-start gap-3 flex-row-reverse -mt-4"
          >
            <div className="w-8 h-8 shrink-0 invisible" />
            <div className="bg-card border border-border/50 rounded-2xl rounded-tr-sm p-4 max-w-[80%] shadow-sm w-64">
              <div className="h-24 rounded-lg bg-muted/50 mb-3 flex items-center justify-center border border-border/30">
                <div className="w-12 h-8 rounded bg-background shadow-sm border border-border flex items-center justify-center">
                  <div className="w-6 h-1 rounded-full bg-primary/40" />
                </div>
              </div>
              <div className="h-3 w-3/4 bg-muted-foreground/20 rounded mb-2" />
              <div className="h-3 w-1/2 bg-muted-foreground/20 rounded" />
            </div>
          </motion.div>
        </div>

        {/* Composer */}
        <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-md">
          <div className="bg-card border border-border/60 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all p-2 flex flex-col">
            <div className="h-16 px-3 py-2">
              <p className="text-sm text-muted-foreground/50">Reply to Sarah...</p>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
              <div className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-muted-foreground/30" />
                  </div>
                ))}
              </div>
              <button className="h-8 px-4 bg-primary text-primary-foreground text-xs font-semibold rounded-lg flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity">
                Send <PaperPlaneRight weight="fill" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
