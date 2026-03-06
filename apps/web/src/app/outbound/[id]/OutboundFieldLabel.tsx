"use client";

import type { ReactNode } from "react";

interface OutboundFieldLabelProps {
  children: ReactNode;
  htmlFor?: string;
}

export function OutboundFieldLabel({ children, htmlFor }: OutboundFieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}
