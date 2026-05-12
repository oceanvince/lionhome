import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface RadioCardProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export function RadioCard({ title, subtitle, selected, onClick, className }: RadioCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col justify-center rounded-[4px] border px-4 py-3 text-left transition-all",
        "min-h-14 cursor-pointer",
        selected
          ? "border-[#2F4F3D] bg-[#EAEFEB] ring-1 ring-[#2F4F3D]"
          : "border-[#E5E5E5] bg-white hover:border-[#2F4F3D]/40",
        className
      )}
    >
      <span
        className={cn(
          "text-sm leading-tight font-medium",
          selected ? "text-[#2F4F3D]" : "text-[#1A1C1A]"
        )}
      >
        {title}
      </span>
      {subtitle && <span className="mt-0.5 text-[11px] font-light text-gray-500">{subtitle}</span>}
    </button>
  );
}
