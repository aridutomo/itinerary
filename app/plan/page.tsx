"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDMY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Langkah 1 dari alur: buat Rencana — dari mana ke mana, dan rentang tanggal.
export default function PlanPage() {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [lokasiAsal, setLokasiAsal] = useState("");
  const [lokasiTujuan, setLokasiTujuan] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState(todayISO());
  const [tanggalSelesai, setTanggalSelesai] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!lokasiAsal.trim() || !lokasiTujuan.trim() || !tanggalMulai) {
      setErr("Lokasi asal, lokasi tujuan, dan tanggal mulai wajib diisi");
      return;
    }
    if (tanggalSelesai && tanggalSelesai < tanggalMulai) {
      setErr("Tanggal selesai tidak boleh sebelum tanggal mulai");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          lokasiAsal: lokasiAsal.trim(),
          lokasiTujuan: lokasiTujuan.trim(),
          tanggalMulai: isoToDMY(tanggalMulai),
          tanggalSelesai: isoToDMY(tanggalSelesai || tanggalMulai),
          orang: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan");
      // Lanjut ke halaman detail rencana untuk menambah tujuan & orang.
      router.push(`/trip/${data.item.id}`);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Rencana Baru" />
      <main className="flex-1 px-4 py-4">
        <Card className="animate-fade-in p-4 shadow-card">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nama">
                Nama Rencana{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </Label>
              <Input
                id="nama"
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="mis. Liburan Bandung"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asal">Dari (Lokasi Asal)</Label>
              <Input
                id="asal"
                type="text"
                value={lokasiAsal}
                onChange={(e) => setLokasiAsal(e.target.value)}
                placeholder="mis. Jakarta"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tujuan">Ke (Lokasi Tujuan)</Label>
              <Input
                id="tujuan"
                type="text"
                value={lokasiTujuan}
                onChange={(e) => setLokasiTujuan(e.target.value)}
                placeholder="mis. Bandung"
                required
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mulai">Tanggal Pergi</Label>
                <Input
                  id="mulai"
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="selesai">Tanggal Pulang</Label>
                <Input
                  id="selesai"
                  type="date"
                  value={tanggalSelesai}
                  min={tanggalMulai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {err && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {err}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="h-11 flex-1"
              >
                Batal
              </Button>
              <Button type="submit" disabled={busy} className="h-11 flex-[2]">
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    Lanjut
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </main>
      <BottomNav />
    </>
  );
}
