"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Time picker format 24 jam. Output tetap "HH:mm" (mis. "08:30"),
// jadi format yang dikirim ke server tidak berubah.
export default function TimeInput({ value, onChange, className, id }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  const [hh, mm] = value.includes(":") ? value.split(":") : ["", ""];

  // Tutup saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Scroll otomatis ke nilai terpilih saat panel dibuka.
  useEffect(() => {
    if (!open) return;
    const scrollSelected = (el: HTMLDivElement | null) => {
      const target = el?.querySelector<HTMLElement>("[data-selected='true']");
      target?.scrollIntoView({ block: "center" });
    };
    requestAnimationFrame(() => {
      scrollSelected(hourRef.current);
      scrollSelected(minuteRef.current);
    });
  }, [open]);

  function select(nextH: string, nextM: string) {
    onChange(`${nextH}:${nextM}`);
  }

  function handleHour(h: string) {
    select(h, mm || "00");
  }

  function handleMinute(m: string) {
    select(hh || "00", m);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn(!value && "text-muted-foreground")}>
          {value || "--:--"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-lg backdrop-blur-sm animate-fade-in">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="flex-1 text-center">Jam</span>
            <span className="flex-1 text-center">Menit</span>
          </div>
          <div className="flex h-44">
            <div
              ref={hourRef}
              className="flex-1 overflow-y-auto py-1 [scrollbar-width:thin]"
            >
              {HOURS.map((h) => {
                const selected = h === hh;
                return (
                  <button
                    key={h}
                    type="button"
                    data-selected={selected}
                    onClick={() => handleHour(h)}
                    className={cn(
                      "block w-full px-2 py-1.5 text-center text-sm transition-colors",
                      selected
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <div className="w-px bg-border" />
            <div
              ref={minuteRef}
              className="flex-1 overflow-y-auto py-1 [scrollbar-width:thin]"
            >
              {MINUTES.map((m) => {
                const selected = m === mm;
                return (
                  <button
                    key={m}
                    type="button"
                    data-selected={selected}
                    onClick={() => handleMinute(m)}
                    className={cn(
                      "block w-full px-2 py-1.5 text-center text-sm transition-colors",
                      selected
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
