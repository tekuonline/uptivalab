import type { HTMLAttributes, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const Card = ({ children, className, ...props }: CardProps) => (
  <div className={twMerge("glass-panel rounded-2xl p-6", className)} {...props}>
    {children}
  </div>
);
