"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Daftar", icon: ClipboardList },
  { href: "/plan", label: "Tambah", icon: Plus },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[480px] grid-cols-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {tabs.map((t) => {
          const active = path?.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-col items-center gap-1 py-1.5"
            >
              <span
                className={cn(
                  "flex h-9 w-16 items-center justify-center rounded-full transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
