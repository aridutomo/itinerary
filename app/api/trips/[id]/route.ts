import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getTrip,
  updateTrip,
  deleteTrip,
  listDetails,
  canAccessTrip,
  listUsers,
  appendNotifications,
  type Trip,
  type NotificationInput,
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

    // Bila daftar orang berubah, kirim notifikasi in-app:
    // - orang yang BARU diundang -> "kamu diundang"
    // - anggota lama (kecuali aktor) -> "ada orang baru ikut"
    if (Array.isArray(patch.orang)) {
      await notifyOrangChanged(existing, trip, user).catch((e) => {
        // Notifikasi bersifat best-effort: jangan gagalkan update trip.
        console.error("Gagal mengirim notifikasi:", e);
      });
    }

    return NextResponse.json({ trip });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Susun & kirim notifikasi ketika daftar orang sebuah trip berubah.
async function notifyOrangChanged(
  before: Trip,
  after: Trip,
  actor: { id: string; name?: string | null }
): Promise<void> {
  const norm = (s: string) => s.toLowerCase().trim();
  const beforeSet = new Set(before.orang.map(norm));
  // Orang yang baru ditambahkan (ada di "after", tidak ada di "before").
  const added = after.orang.filter((o) => !beforeSet.has(norm(o)));
  if (added.length === 0) return;

  // Peta User ID -> nama tampilan untuk pesan yang ramah.
  const users = await listUsers();
  const nameOf = (idOrName: string) => {
    const u = users.find((x) => norm(x.id) === norm(idOrName));
    return u?.nama || u?.namaLengkap || idOrName;
  };

  const tripLabel =
    after.nama?.trim() || `${after.lokasiAsal} → ${after.lokasiTujuan}`;
  const actorName = actor.name?.trim() || nameOf(actor.id);
  const addedNorm = new Set(added.map(norm));
  const notifs: NotificationInput[] = [];

  // 1) Notifikasi undangan untuk tiap orang yang baru ditambahkan.
  for (const person of added) {
    if (norm(person) === norm(actor.id)) continue; // jangan kirim ke diri sendiri
    notifs.push({
      userId: person,
      tipe: "undangan",
      pesan: `${actorName} mengundang kamu ke rencana "${tripLabel}"`,
      tripId: after.id,
    });
  }

  // 2) Notifikasi "anggota baru" untuk anggota lama (kecuali aktor & yg baru).
  const addedLabels = added.map(nameOf).join(", ");
  for (const member of before.orang) {
    if (norm(member) === norm(actor.id)) continue;
    if (addedNorm.has(norm(member))) continue;
    notifs.push({
      userId: member,
      tipe: "anggota_baru",
      pesan: `${addedLabels} ditambahkan ke rencana "${tripLabel}" oleh ${actorName}`,
      tripId: after.id,
    });
  }

  await appendNotifications(notifs, actor.id);
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
