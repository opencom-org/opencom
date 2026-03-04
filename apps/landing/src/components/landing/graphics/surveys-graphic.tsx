"use client";

import { motion } from "framer-motion";
import { ClipboardText, Star } from "@phosphor-icons/react";

export function SurveysGraphic() {
  return (
    <div className="relative w-full h-full bg-[#f9fafb] dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center font-sans p-8">
      {/* Decorative Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100 }}
        className="relative z-10 w-full max-w-sm bg-card rounded-[2rem] shadow-2xl border border-border/50 overflow-hidden"
      >
        {/* Survey Header */}
        <div className="h-2 bg-gradient-to-r from-violet-500 to-primary w-full" />
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center mx-auto mb-4">
            <ClipboardText weight="duotone" className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">How are we doing?</h3>
          <p className="text-sm text-muted-foreground">We&apos;d love to hear your feedback on the new dashboard features.</p>
        </div>

        {/* Survey Interactive Area */}
        <div className="p-6 pt-0 space-y-6">
          {/* NPS Scale Mockup */}
          <div className="space-y-3">
            <div className="flex justify-between px-1">
              {[1, 2, 3, 4, 5].map((num) => (
                <motion.div
                  key={num}
                  whileHover={{ scale: 1.1 }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${
                    num === 4 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {num}
                </motion.div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-medium text-muted-foreground px-2 uppercase tracking-wider">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Feedback Textarea Mockup */}
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ delay: 0.5 }}
            className="space-y-2"
          >
            <div className="h-24 w-full rounded-xl bg-muted/30 border border-border/50 p-3">
              <div className="h-2 w-32 bg-muted rounded mb-2" />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "80%" }}
                transition={{ delay: 1, duration: 1 }}
                className="h-2 bg-primary/40 rounded"
              />
            </div>
          </motion.div>

          {/* Submit Button */}
          <button className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-bold shadow-md hover:opacity-90 transition-opacity">
            Submit Feedback
          </button>
        </div>
      </motion.div>
      
      {/* Floating Success Toast */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 2, type: "spring" }}
        className="absolute bottom-8 right-8 bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 rounded-lg border border-green-500/20 text-xs font-bold flex items-center gap-2 shadow-lg"
      >
        <Star weight="fill" className="w-4 h-4" />
        Response recorded
      </motion.div>
    </div>
  );
}
