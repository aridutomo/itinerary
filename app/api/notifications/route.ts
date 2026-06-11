import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listNotificationsForUser } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Daftar notifikasi milik user yang sedang login (terbaru di atas).
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await listNotificationsForUser(user.id);
    const unread = items.filter((n) => !n.dibaca).length;
    return NextResponse.json({ items, unread });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal memuat notifikasi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
