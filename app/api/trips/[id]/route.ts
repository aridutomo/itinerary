import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getTrip,
  updateTrip,
  deleteTrip,
  listDetails,
  canAccessTrip,
  type Trip,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Ambil satu trip beserta daftar detail tujuannya.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const trip = await getTrip(params.id);
    if (!trip || !canAccessTrip(trip, user)) {
      return NextResponse.json({ error: "Rencana tidak ditemukan" }, { status: 404 });
    }
    const details = await listDetails(params.id);
    details.sort((a, b) => {
      const ta = `${a.tanggal} ${a.jamBerangkat}`;
      const tb = `${b.tanggal} ${b.jamBerangkat}`;
      return ta.localeCompare(tb);
    });
    return NextResponse.json({ trip, details });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal memuat data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Update sebagian field trip — dipakai untuk menambah/menghapus orang.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const existing = await getTrip(params.id);
    if (!existing || !canAccessTrip(existing, user)) {
      return NextResponse.json({ error: "Rencana tidak ditemukan" }, { status: 404 });
    }
    const body = (await req.json()) as Partial<Trip>;
    const patch: Partial<Trip> = {};
    if (Array.isArray(body.orang)) patch.orang = body.orang;
    if (typeof body.nama === "string") patch.nama = body.nama;
    if (typeof body.lokasiAsal === "string") patch.lokasiAsal = body.lokasiAsal;
    if (typeof body.lokasiTujuan === "string") patch.lokasiTujuan = body.lokasiTujuan;
    if (typeof body.tanggalMulai === "string") patch.tanggalMulai = body.tanggalMulai;
    if (typeof body.tanggalSelesai === "string") patch.tanggalSelesai = body.tanggalSelesai;

    const trip = await updateTrip(params.id, patch, user.id);
    if (!trip) {
      return NextResponse.json({ error: "Rencana tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ trip });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const existing = await getTrip(params.id);
    if (!existing || !canAccessTrip(existing, user)) {
      return NextResponse.json({ error: "Rencana tidak ditemukan" }, { status: 404 });
    }
    const ok = await deleteTrip(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Rencana tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal menghapus";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
