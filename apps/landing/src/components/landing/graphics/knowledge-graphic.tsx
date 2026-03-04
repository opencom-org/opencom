"use client";

import { motion } from "framer-motion";
import { BookOpenText, Folder, Article, MagnifyingGlass } from "@phosphor-icons/react";

export function KnowledgeBaseGraphic() {
  return (
    <div className="relative w-full h-full bg-background dark:bg-[#0a0a0a] overflow-hidden flex font-sans">
      {/* Sidebar */}
      <div className="w-[30%] h-full border-r border-border/50 bg-muted/10 p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border/50 rounded-lg text-muted-foreground">
          <MagnifyingGlass className="w-4 h-4" />
          <span className="text-xs">Search articles...</span>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
            <Folder weight="fill" className="w-4 h-4" />
            Getting Started
          </div>
          <div className="pl-6 space-y-1">
            <div className="flex items-center gap-2 px-2 py-1 rounded-md text-foreground text-xs font-medium bg-muted/50">
              <Article weight="fill" className="w-3 h-3 text-muted-foreground" />
              Installation Guide
            </div>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground text-xs transition-colors">
              <Article className="w-3 h-3" />
              Quickstart Tutorial
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-foreground text-sm font-medium hover:bg-muted/50 transition-colors">
            <Folder weight="fill" className="w-4 h-4 text-blue-500" />
            API Reference
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 h-full p-8 relative flex flex-col">
        {/* Floating Toolbar */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute top-6 left-1/2 -translate-x-1/2 bg-card border border-border/50 rounded-lg shadow-sm px-3 py-1.5 flex items-center gap-2"
        >
          <div className="w-4 h-4 rounded bg-muted flex items-center justify-center text-[10px] font-bold">B</div>
          <div className="w-4 h-4 rounded hover:bg-muted flex items-center justify-center text-[10px] italic">I</div>
          <div className="w-4 h-4 rounded hover:bg-muted flex items-center justify-center text-[10px] underline">U</div>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <div className="w-4 h-4 rounded hover:bg-muted flex items-center justify-center text-[10px]">H1</div>
          <div className="w-4 h-4 rounded hover:bg-muted flex items-center justify-center text-[10px]">H2</div>
        </motion.div>

        <div className="mt-12 space-y-6 max-w-lg">
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl font-bold tracking-tight text-foreground focus:outline-none"
          >
            Installation Guide
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              Welcome to the Opencom installation guide. This document will walk you through setting up the core platform and integrating the frontend widgets.
            </p>

            <div className="bg-muted/30 border border-border/50 rounded-xl p-4 font-mono text-xs text-foreground/80 relative group">
              <div className="absolute top-2 right-2 w-4 h-4 rounded bg-muted-foreground/20" />
              <span className="text-primary">npm</span> install @opencom/widget<br/>
              <span className="text-primary">npx</span> opencom init
            </div>

            <div className="flex items-center gap-2">
              <div className="h-2 w-full bg-muted rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-5/6 bg-muted rounded" />
            </div>
          </motion.div>
        </div>

        {/* Abstract Publish Button */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring" }}
          className="absolute bottom-6 right-6 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-lg flex items-center gap-2"
        >
          <BookOpenText weight="fill" className="w-4 h-4" />
          Publish Article
        </motion.div>
      </div>
    </div>
  );
}
