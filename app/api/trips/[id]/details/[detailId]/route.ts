import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTrip, deleteDetail, canAccessTrip } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; detailId: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const trip = await getTrip(params.id);
    if (!trip || !canAccessTrip(trip, user)) {
      return NextResponse.json(
        { error: "Detail tidak ditemukan" },
        { status: 404 }
      );
    }
    const ok = await deleteDetail(params.detailId);
    if (!ok) {
      return NextResponse.json(
        { error: "Detail tidak ditemukan" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal menghapus";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
