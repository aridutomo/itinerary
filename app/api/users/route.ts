import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listUsers } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Daftar user untuk fitur "undang orang" (lookup). Tanpa password.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const users = await listUsers();
    const items = users
      .filter((u) => u.aktif) // hanya user aktif yang bisa diundang
      .map((u) => ({
        id: u.id,
        nama: u.nama,
        namaLengkap: u.namaLengkap,
      }));
    return NextResponse.json({ items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal memuat data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
