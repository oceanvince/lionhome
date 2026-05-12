import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface Option<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" className={cn("flex gap-1 rounded-[4px] bg-gray-100 p-1", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-[44px] flex-1 rounded-[4px] px-2 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-white text-[#2F4F3D] shadow-sm ring-1 ring-[#E5E5E5]"
                : "text-gray-500 hover:text-[#1A1C1A]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
