import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Tandai notifikasi sebagai sudah dibaca.
// Body opsional: { ids?: string[] }. Tanpa ids -> tandai semua milik user.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((v: unknown): v is string => typeof v === "string")
      : undefined;
    const updated = await markNotificationsRead(user.id, ids);
    return NextResponse.json({ ok: true, updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal memperbarui notifikasi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
