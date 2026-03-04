"use client";

import { motion } from "framer-motion";
import { Ticket, CaretDown, ChatTeardropText, CircleDashed } from "@phosphor-icons/react";

export function TicketsGraphic() {
  return (
    <div className="relative w-full h-full bg-background dark:bg-[#0a0a0a] overflow-hidden flex font-sans">
      <div className="w-full h-full p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Ticket weight="duotone" className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Support Tickets</h3>
              <p className="text-xs text-muted-foreground">3 pending actions</p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
            New Ticket
          </div>
        </div>

        {/* Tickets List */}
        <div className="space-y-3 relative z-10">
          {[
            { id: "T-4092", title: "Cannot access billing page", status: "High Priority", color: "red", active: true },
            { id: "T-4091", title: "API Rate limit exceeded", status: "In Progress", color: "blue", active: false },
            { id: "T-4090", title: "How to export user data?", status: "Pending", color: "orange", active: false }
          ].map((ticket, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.2 }}
              className={`p-4 rounded-xl border ${ticket.active ? 'border-primary shadow-md bg-card' : 'border-border/50 bg-muted/20'} flex items-center justify-between`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full bg-${ticket.color}-500 ${ticket.active ? 'animate-pulse' : ''}`} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
                    <h4 className="text-sm font-medium">{ticket.title}</h4>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md bg-${ticket.color}-500/10 text-${ticket.color}-500 font-medium`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full border-2 border-background bg-slate-300" />
                <div className="w-6 h-6 rounded-full border-2 border-background bg-slate-400" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Floating Detail Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, type: "spring", stiffness: 100 }}
          className="absolute bottom-6 right-6 w-72 bg-card border border-border/50 rounded-2xl shadow-2xl p-4 z-20"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono text-muted-foreground">T-4092</span>
            <div className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded-md">
              <CircleDashed className="w-3 h-3 animate-spin" />
              High Priority
            </div>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="h-2 bg-muted rounded w-full" />
            <div className="h-2 bg-muted rounded w-5/6" />
            <div className="h-2 bg-muted rounded w-4/6" />
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-border/50">
            <div className="flex-1 h-8 rounded-lg bg-muted flex items-center px-3 gap-2">
              <ChatTeardropText className="w-4 h-4 text-muted-foreground" />
              <div className="h-2 bg-muted-foreground/30 rounded w-20" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <CaretDown weight="bold" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
