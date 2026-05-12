import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface BucketSelectorProps {
  buckets: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  label?: string;
  className?: string;
}

export function BucketSelector({
  buckets,
  selectedIndex,
  onChange,
  label,
  className,
}: BucketSelectorProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <p className="mb-2 text-[11px] font-medium tracking-[0.2em] text-gray-500 uppercase">
          {label}
        </p>
      )}
      <ul role="listbox" aria-label={label} className="space-y-1.5">
        {buckets.map((bucket, i) => {
          const selected = i === selectedIndex;
          return (
            <li key={i} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onChange(i)}
                className={cn(
                  "flex min-h-14 w-full items-center rounded-[4px] border px-4 py-3 text-left text-sm transition-all",
                  selected
                    ? "border-[#2F4F3D] bg-[#EAEFEB] font-medium text-[#2F4F3D] ring-1 ring-[#2F4F3D]"
                    : "border-[#E5E5E5] bg-white text-[#1A1C1A] hover:border-[#2F4F3D]/40"
                )}
              >
                <span
                  className={cn(
                    "mr-3 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-[#2F4F3D] bg-[#2F4F3D]" : "border-gray-300"
                  )}
                >
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                {bucket}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
