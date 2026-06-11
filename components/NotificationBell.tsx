"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Loader2, MapPinned, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

const POLL_MS = 10_000; // Lebih cepat (10 detik) untuk efek real-time
const SESSION_KEY = "notif-modal-auto-shown";

export default function NotificationBell() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const refresh = useCallback(async (isInitial = false, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const unreadItems = (data.items ?? []).filter((n: Notification) => !n.dibaca);
      
      setItems(unreadItems);
      setUnread(data.unread ?? 0);

      const latest = unreadItems[0];
      
      // 1. Auto-show awal sesi
      if (isInitial && unreadItems.length > 0 && !sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setOpen(true);
        if (latest) setLastId(latest.id);
      } 
      // 2. Real-time trigger: Jika ada notifikasi baru yang masuk saat sedang buka aplikasi
      else if (!isInitial && latest && latest.id !== lastId) {
        setOpen(true);
        setLastId(latest.id);
      }
      // Update lastId jika ada data tapi belum di-set
      else if (latest && !lastId) {
        setLastId(latest.id);
      }
    } catch {
      // Diam: notifikasi best-effort.
    } finally {
      if (!silent) setLoading(false);
    }
  }, [lastId]);

  // Polling berkala selama user login.
  useEffect(() => {
    if (status !== "authenticated") return;
    refresh(true, false); 
    const t = setInterval(() => refresh(false, true), POLL_MS);
    return () => clearInterval(t);
  }, [status, refresh]);

  function handleToggle() {
    setOpen(true);
    refresh(false, false);
  }

  function markAllRead() {
    fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
    setUnread(0);
    setItems([]);
  }

  function tandaiDibaca() {
    markAllRead();
    setOpen(false);
  }

  function openTrip(n: Notification) {
    markAllRead();
    setOpen(false);
    if (n.tripId) router.push(`/trip/${n.tripId}`);
  }

  if (status !== "authenticated") return null;

  return (
    <>
      <button
        onClick={handleToggle}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle>Notifikasi Belum Dibaca</DialogTitle>
              <DialogDescription>
                {loading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Memuat...
                  </span>
                ) : (
                  `${items.length} pemberitahuan baru menunggu`
                )}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Tidak ada notifikasi belum dibaca
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openTrip(n)}
                      className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors duration-200 hover:bg-accent"
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
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="border-t px-5 py-3.5">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Nanti
            </Button>
            {items.length > 0 && (
              <Button className="flex-1" onClick={tandaiDibaca}>
                Tandai sudah dibaca
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
