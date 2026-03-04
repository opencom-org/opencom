"use client";

import { motion } from "framer-motion";
import { CheckSquareOffset, DotsSixVertical, Plus } from "@phosphor-icons/react";

export function ChecklistsGraphic() {
  return (
    <div className="relative w-full h-full bg-[#f9fafb] dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-8">
      {/* Background Dots */}
      <div className="absolute inset-0 opacity-20 pointer-events-none p-6">
        <div className="w-full h-full border-2 border-dashed border-border/40 rounded-3xl" />
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border/50 overflow-hidden"
      >
        <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Onboarding Checklist</h3>
            <p className="text-[10px] text-muted-foreground">Target: New Signups</p>
          </div>
          <div className="px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider">
            Active
          </div>
        </div>

        <div className="p-4 space-y-3">
          {[
            { title: "Complete Profile", desc: "Add your name and avatar", done: true, active: false },
            { title: "Invite Team Members", desc: "Invite at least 2 colleagues", done: false, active: true },
            { title: "Connect Integration", desc: "Link Slack or Linear", done: false, active: false },
          ].map((task, i) => (
            <motion.div 
              key={i}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.15 }}
              className={`group flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                task.active 
                  ? 'border-primary/40 bg-primary/5 shadow-sm' 
                  : 'border-border/50 bg-background hover:border-border'
              }`}
            >
              <DotsSixVertical className="w-4 h-4 text-muted-foreground/30 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
              
              <div className={`mt-0.5 shrink-0 transition-colors ${task.done ? 'text-primary' : 'text-muted-foreground/40'}`}>
                <CheckSquareOffset weight={task.done ? "fill" : "regular"} className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${task.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {task.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">{task.desc}</div>
                
                {task.active && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="mt-3 flex items-center gap-2"
                  >
                    <button className="px-3 py-1.5 text-[10px] font-semibold bg-primary text-primary-foreground rounded-md shadow-sm">
                      Edit Action
                    </button>
                    <span className="text-[10px] text-muted-foreground">Trigger: Tour Completed</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-2.5 rounded-xl border border-dashed border-border flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
          >
            <Plus weight="bold" /> Add Step
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
