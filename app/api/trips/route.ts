import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listTripsForUser, appendTrip, type Trip } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await listTripsForUser(user);
    items.sort((a, b) => b.tanggalMulai.localeCompare(a.tanggalMulai));
    return NextResponse.json({ items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal memuat data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as Partial<Trip>;
    if (!body.lokasiAsal || !body.lokasiTujuan || !body.tanggalMulai) {
      return NextResponse.json(
        { error: "Lokasi asal, lokasi tujuan, dan tanggal mulai wajib diisi" },
        { status: 400 }
      );
    }
    const trip = await appendTrip(
      {
        nama: body.nama ?? "",
        lokasiAsal: body.lokasiAsal,
        lokasiTujuan: body.lokasiTujuan,
        tanggalMulai: body.tanggalMulai,
        tanggalSelesai: body.tanggalSelesai ?? body.tanggalMulai,
        orang: Array.isArray(body.orang) ? body.orang : [],
      },
      user.id
    );
    return NextResponse.json({ item: trip }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
