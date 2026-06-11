"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Map, Plus, RotateCw } from "lucide-react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import TripCard from "@/components/TripCard";
import { Button } from "@/components/ui/button";
import type { Trip } from "@/lib/sheets";

export default function DashboardPage() {
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/trips", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat");
      setItems(data.items ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <TopBar title="Rencana Perjalanan" />
      <main className="flex flex-1 flex-col gap-3 px-4 py-4">
        {loading && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border bg-card shadow-card"
              />
            ))}
          </div>
        )}

        {err && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{err}</span>
            <button
              onClick={load}
              className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
            >
              <RotateCw className="h-3.5 w-3.5" />
              coba lagi
            </button>
          </div>
        )}

        {!loading && !err && items.length === 0 && (
          <div className="mt-12 flex animate-fade-in flex-col items-center px-6 text-center">
            <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Map className="h-8 w-8" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">
              Belum ada rencana
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buat rencana perjalanan pertama Anda.
            </p>
            <Button asChild className="mt-6 h-11">
              <Link href="/plan">
                <Plus className="h-4 w-4" />
                Buat Rencana
              </Link>
            </Button>
          </div>
        )}

        {!loading &&
          !err &&
          items.map((trip) => <TripCard key={trip.id} trip={trip} />)}
      </main>
      <BottomNav />
    </>
  );
}
