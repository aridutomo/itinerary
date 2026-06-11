import { NextResponse } from "next/server";
import { appendUser, type User } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<User>;
    const id = (body.id ?? "").trim();
    const nama = (body.nama ?? "").trim();
    const namaLengkap = (body.namaLengkap ?? "").trim();
    const password = body.password ?? "";

    if (!id || !nama || !namaLengkap || !password) {
      return NextResponse.json(
        { error: "User ID, Nama, Nama Lengkap, dan Password wajib diisi" },
        { status: 400 }
      );
    }

    const user = await appendUser({ id, nama, namaLengkap, password });
    // Jangan kembalikan password ke client.
    return NextResponse.json(
      { item: { id: user.id, nama: user.nama, namaLengkap: user.namaLengkap } },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal mendaftar";
    const status = msg.includes("sudah terdaftar") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
