"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  Calendar,
  Loader2,
  MapPin,
  Plus,
  RotateCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import DetailCard from "@/components/DetailCard";
import TimeInput from "@/components/TimeInput";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Trip, Detail } from "@/lib/sheets";

function dateRange(mulai: string, selesai: string): string {
  if (!mulai) return "Tanpa tanggal";
  if (!selesai || selesai === mulai) return mulai;
  return `${mulai} – ${selesai}`;
}

function isoToDMY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Format stempel waktu audit (ISO) menjadi "dd/mm/yyyy HH:MM" lokal.
function formatStamp(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [details, setDetails] = useState<Detail[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat");
      setTrip(data.trip);
      setDetails(data.details ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tripId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  function handleDetailDeleted(id: string) {
    setDetails((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleDeleteTrip() {
    if (!confirm("Hapus seluruh rencana ini beserta semua tujuannya?")) return;
    const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Gagal menghapus");
    }
  }

  return (
    <>
      <TopBar title="Detail Rencana" />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Memuat data...
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

        {!loading && !err && trip && (
          <>
            {/* Ringkasan rencana */}
            <Card className="animate-fade-in overflow-hidden shadow-card">
              <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-4 pb-5 pt-4 text-white">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
                  <Calendar className="h-3.5 w-3.5" />
                  {dateRange(trip.tanggalMulai, trip.tanggalSelesai)}
                </div>
                <h2 className="mt-2.5 text-xl font-bold leading-tight">
                  {trip.nama?.trim() ||
                    `${trip.lokasiAsal} → ${trip.lokasiTujuan}`}
                </h2>
              </div>
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-emerald-500" />
                    <span className="truncate text-sm text-muted-foreground">
                      {trip.lokasiAsal}
                    </span>
                  </div>
                  <span className="h-px flex-1 bg-gradient-to-r from-emerald-300 to-rose-300" />
                  <div className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                    <span className="truncate text-sm font-medium text-foreground">
                      {trip.lokasiTujuan}
                    </span>
                  </div>
                </div>

                {(trip.createdBy || trip.modifiedBy) && (
                  <div className="mt-3 flex flex-col gap-0.5 border-t pt-3 text-[11px] text-muted-foreground/80">
                    {trip.createdBy && (
                      <span>
                        Dibuat oleh {trip.createdBy}
                        {trip.createdTime
                          ? ` • ${formatStamp(trip.createdTime)}`
                          : ""}
                      </span>
                    )}
                    {trip.modifiedBy && (
                      <span>
                        Diubah oleh {trip.modifiedBy}
                        {trip.modifiedTime
                          ? ` • ${formatStamp(trip.modifiedTime)}`
                          : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Orang */}
            <PeopleSection
              tripId={tripId}
              orang={trip.orang}
              onChange={(orang) => setTrip({ ...trip, orang })}
            />

            {/* Daftar tujuan */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tujuan
                </h3>
                <Badge
                  variant="secondary"
                  className="h-5 min-w-[20px] justify-center px-1.5"
                >
                  {details.length}
                </Badge>
              </div>
              {details.length === 0 && (
                <div className="rounded-xl border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada tujuan. Tambahkan tempat yang ingin dikunjungi.
                </div>
              )}
              {details.map((d) => (
                <DetailCard
                  key={d.id}
                  item={d}
                  onDeleted={handleDetailDeleted}
                />
              ))}
            </section>

            {/* Form tambah tujuan */}
            <AddDetailForm
              tripId={tripId}
              defaultAsal={trip.lokasiTujuan}
              onAdded={(d) => setDetails((prev) => [...prev, d])}
            />

            <Button
              variant="outline"
              onClick={handleDeleteTrip}
              className="mt-1 h-11 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Hapus Rencana
            </Button>
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}

// ===== Bagian: kelola orang (lookup dari daftar Users) =====
type UserOption = { id: string; nama: string; namaLengkap: string };

function PeopleSection({
  tripId,
  orang,
  onChange,
}: {
  tripId: string;
  orang: string[];
  onChange: (orang: string[]) => void;
}) {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id ?? "";
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);

  // Ambil daftar user sekali untuk fitur lookup.
  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = await res.json();
        if (aktif && res.ok) setUsers(data.items ?? []);
      } catch {
        // Abaikan; lookup hanya tidak tersedia.
      }
    })();
    return () => {
      aktif = false;
    };
  }, []);

  // Tampilkan nama bila nilai tersimpan cocok dengan User ID yang dikenal.
  function labelFor(value: string): string {
    const u = users.find((x) => x.id.toLowerCase() === value.toLowerCase());
    return u ? u.nama || u.namaLengkap || u.id : value;
  }

  // Saran user yang cocok dengan query dan belum diundang.
  const q = query.trim().toLowerCase();
  const suggestions = users.filter((u) => {
    // User yang sedang login tidak perlu diundang ke rencananya sendiri.
    if (myId && u.id.toLowerCase() === myId.toLowerCase()) return false;
    const sudah = orang.some((o) => o.toLowerCase() === u.id.toLowerCase());
    if (sudah) return false;
    if (!q) return true;
    return (
      u.id.toLowerCase().includes(q) ||
      u.nama.toLowerCase().includes(q) ||
      u.namaLengkap.toLowerCase().includes(q)
    );
  });

  async function save(next: string[]) {
    setBusy(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orang: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan");
      onChange(data.trip.orang ?? next);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  function addUser(u: UserOption) {
    setQuery("");
    setOpen(false);
    if (orang.some((o) => o.toLowerCase() === u.id.toLowerCase())) return;
    save([...orang, u.id]);
  }

  function removePerson(value: string) {
    save(orang.filter((x) => x !== value));
  }

  return (
    <Card className="animate-fade-in p-4 shadow-card">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-muted-foreground" />
        Orang
        <Badge
          variant="secondary"
          className="h-5 min-w-[20px] justify-center px-1.5"
        >
          {orang.length}
        </Badge>
      </h3>

      {orang.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {orang.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-sm font-medium text-primary"
            >
              {labelFor(value)}
              <button
                onClick={() => removePerson(value)}
                disabled={busy}
                className="flex h-4 w-4 items-center justify-center rounded-full text-primary/60 transition-colors hover:bg-primary/20 hover:text-primary disabled:opacity-50"
                aria-label={`Hapus ${labelFor(value)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Lookup user */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Cari & undang orang..."
          className="h-11 pl-9"
        />
        {open && (
          <ul className="absolute z-20 mt-1.5 max-h-56 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-lift">
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {users.length === 0
                  ? "Tidak ada data user"
                  : "Tidak ada hasil"}
              </li>
            ) : (
              suggestions.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addUser(u)}
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-semibold text-white">
                      {(u.nama || u.namaLengkap || u.id)
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {u.nama || u.namaLengkap || u.id}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {u.namaLengkap && u.namaLengkap !== u.nama
                          ? `${u.namaLengkap} · `
                          : ""}
                        {u.id}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ===== Bagian: tambah tujuan =====
function AddDetailForm({
  tripId,
  defaultAsal,
  onAdded,
}: {
  tripId: string;
  defaultAsal: string;
  onAdded: (d: Detail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tanggal, setTanggal] = useState("");
  const [jamBerangkat, setJamBerangkat] = useState("");
  const [jamTiba, setJamTiba] = useState("");
  const [lokasiAsal, setLokasiAsal] = useState("");
  const [lokasiTujuan, setLokasiTujuan] = useState("");
  const [estimasiDurasi, setEstimasiDurasi] = useState("");
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setTanggal("");
    setJamBerangkat("");
    setJamTiba("");
    setLokasiAsal("");
    setLokasiTujuan("");
    setEstimasiDurasi("");
    setCatatan("");
    setErr(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!lokasiTujuan.trim()) {
      setErr("Lokasi tujuan wajib diisi");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/details`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tanggal: isoToDMY(tanggal),
          jamBerangkat,
          jamTiba,
          lokasiAsal: lokasiAsal.trim() || defaultAsal,
          lokasiTujuan: lokasiTujuan.trim(),
          estimasiDurasi,
          catatan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan");
      onAdded(data.item);
      reset();
      setOpen(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-3.5 font-semibold text-primary transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
        Tambah Tujuan
      </button>
    );
  }

  return (
    <Card className="animate-fade-in p-4 shadow-card">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          Tujuan Baru
        </h3>

        <div className="space-y-1.5">
          <Label htmlFor="d-tujuan">Lokasi Tujuan</Label>
          <Input
            id="d-tujuan"
            type="text"
            value={lokasiTujuan}
            onChange={(e) => setLokasiTujuan(e.target.value)}
            placeholder="mis. Pantai ABC"
            required
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-asal">
            Dari{" "}
            <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Input
            id="d-asal"
            type="text"
            value={lokasiAsal}
            onChange={(e) => setLokasiAsal(e.target.value)}
            placeholder={defaultAsal || "Lokasi asal"}
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-tanggal">Tanggal</Label>
          <Input
            id="d-tanggal"
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="d-berangkat">Jam Berangkat</Label>
            <TimeInput
              id="d-berangkat"
              value={jamBerangkat}
              onChange={setJamBerangkat}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-tiba">Jam Tiba</Label>
            <TimeInput
              id="d-tiba"
              value={jamTiba}
              onChange={setJamTiba}
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-durasi">Estimasi di Jalan</Label>
          <Input
            id="d-durasi"
            type="text"
            value={estimasiDurasi}
            onChange={(e) => setEstimasiDurasi(e.target.value)}
            placeholder="mis. 45 menit"
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-catatan">Catatan / Kegiatan</Label>
          <Textarea
            id="d-catatan"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            placeholder="Rencana di sana..."
          />
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
            onClick={() => {
              reset();
              setOpen(false);
            }}
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
              "Simpan Tujuan"
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
