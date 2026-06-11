"use client";

import { useState } from "react";
import { Clock, MapPin, Navigation, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Detail } from "@/lib/sheets";

function mapsDirUrl(asal: string, tujuan: string) {
  const o = encodeURIComponent(asal);
  const d = encodeURIComponent(tujuan);
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}`;
}

function mapsSearchUrl(q: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}

export default function DetailCard({
  item,
  onDeleted,
}: {
  item: Detail;
  onDeleted?: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Hapus tujuan ini?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/trips/${encodeURIComponent(item.tripId)}/details/${encodeURIComponent(
          item.id
        )}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Gagal menghapus");
        return;
      }
      onDeleted?.(item.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="animate-fade-in p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.tanggal && (
            <div className="text-xs font-medium uppercase tracking-wide text-primary">
              {item.tanggal}
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {item.jamBerangkat || "—"}
            {item.jamTiba ? (
              <>
                <span className="text-muted-foreground/50">→</span>
                {item.jamTiba}
              </>
            ) : null}
          </div>
        </div>
        {item.estimasiDurasi && (
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary hover:bg-primary/10"
          >
            {item.estimasiDurasi}
          </Badge>
        )}
      </div>

      {/* Rute dengan garis penghubung vertikal */}
      <div className="mt-3.5">
        {item.lokasiAsal && (
          <div className="flex items-center gap-3">
            <span className="flex w-4 justify-center">
              <span className="h-3 w-3 rounded-full border-2 border-emerald-500" />
            </span>
            <a
              href={mapsSearchUrl(item.lokasiAsal)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm text-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              {item.lokasiAsal}
            </a>
          </div>
        )}
        {item.lokasiAsal && (
          <div className="flex">
            <span className="flex w-4 justify-center">
              <span className="my-0.5 h-4 w-px bg-border" />
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="flex w-4 justify-center">
            <MapPin className="h-4 w-4 text-rose-500" />
          </span>
          <a
            href={mapsSearchUrl(item.lokasiTujuan)}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {item.lokasiTujuan}
          </a>
        </div>
      </div>

      {item.catatan && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          {item.catatan}
        </p>
      )}

      <div className="mt-3.5 flex gap-2">
        <Button asChild className="h-11 flex-1">
          <a
            href={mapsDirUrl(
              item.lokasiAsal || item.lokasiTujuan,
              item.lokasiTujuan
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation className="h-4 w-4" />
            Buka di Maps
          </a>
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleDelete}
          disabled={busy}
          aria-label="Hapus"
          className="h-11 w-11 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </Card>
  );
}
