"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();

  const [userid, setUserid] = useState("");
  const [nama, setNama] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userid, nama, namaLengkap, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "Gagal mendaftar");
        setLoading(false);
        return;
      }
      // Langsung login setelah registrasi berhasil.
      const login = await signIn("credentials", {
        userid,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      setLoading(false);
      if (!login || login.error) {
        // Registrasi sukses tapi auto-login gagal — arahkan ke login.
        router.replace("/login");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErr("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-8 animate-fade-in">
        <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lift">
          <UserPlus className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Buat akun
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Mulai susun rencana perjalanan Anda
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex animate-fade-in flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="userid">User ID</Label>
          <Input
            id="userid"
            type="text"
            value={userid}
            onChange={(e) => setUserid(e.target.value)}
            autoComplete="username"
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nama">Nama</Label>
          <Input
            id="nama"
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="namaLengkap">Nama Lengkap</Label>
          <Input
            id="namaLengkap"
            type="text"
            value={namaLengkap}
            onChange={(e) => setNamaLengkap(e.target.value)}
            autoComplete="name"
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            className="h-11"
          />
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {err}
          </div>
        )}

        <Button type="submit" disabled={loading} className="mt-2 h-11 text-[15px]">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Memproses..." : "Daftar"}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary-600 hover:text-primary-700"
        >
          Masuk
        </Link>
      </p>
    </div>
  );
}
