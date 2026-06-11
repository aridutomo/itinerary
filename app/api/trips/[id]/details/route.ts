import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTrip, appendDetail, canAccessTrip, type Detail } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Tambah detail tujuan ke sebuah trip.
export async function POST(
  req: Request,
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
    const body = (await req.json()) as Partial<Detail>;
    if (!body.lokasiTujuan) {
      return NextResponse.json(
        { error: "Lokasi tujuan wajib diisi" },
        { status: 400 }
      );
    }
    const detail = await appendDetail(
      {
        tripId: params.id,
        tanggal: body.tanggal ?? "",
        jamBerangkat: body.jamBerangkat ?? "",
        lokasiAsal: body.lokasiAsal ?? "",
        lokasiTujuan: body.lokasiTujuan,
        estimasiDurasi: body.estimasiDurasi ?? "",
        jamTiba: body.jamTiba ?? "",
        catatan: body.catatan ?? "",
      },
      user.id
    );
    return NextResponse.json({ item: detail }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
