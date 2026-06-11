"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Loader2, MapPinned, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  userId: string;
  tipe: string;
  pesan: string;
  tripId: string;
  dibaca: boolean;
  createdBy: string;
  createdTime: string;
};

const POLL_MS = 30_000;

export default function NotificationBell() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // Diam: notifikasi best-effort.
    }
  }, []);

  // Polling berkala selama user login.
  useEffect(() => {
    if (status !== "authenticated") return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [status, refresh]);

  // Tutup saat klik di luar panel.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await refresh();
      setLoading(false);
      // Buka panel = anggap semua sudah dibaca.
      if (unread > 0) {
        setUnread(0);
        setItems((prev) => prev.map((n) => ({ ...n, dibaca: true })));
        fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
      }
    }
  }

  function openTrip(n: Notification) {
    setOpen(false);
    if (n.tripId) router.push(`/trip/${n.tripId}`);
  }

  if (status !== "authenticated") return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label="Notifikasi"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-popover/95 shadow-lift backdrop-blur-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              Notifikasi
            </span>
            {loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="max-h-[60vh] overflow-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Belum ada notifikasi
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openTrip(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-accent",
                        !n.dibaca && "bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          n.tipe === "undangan"
                            ? "bg-primary/10 text-primary"
                            : "bg-emerald-500/10 text-emerald-600"
                        )}
                      >
                        {n.tipe === "undangan" ? (
                          <UserPlus className="h-4 w-4" />
                        ) : (
                          <MapPinned className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug text-foreground">
                          {n.pesan}
                        </span>
                        {n.createdTime && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {n.createdTime}
                          </span>
                        )}
                      </span>
                      {!n.dibaca && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
