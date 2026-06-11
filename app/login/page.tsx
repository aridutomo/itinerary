"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useState } from "react";
import { AlertCircle, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signIn("credentials", {
      userid,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (!res || res.error) {
      setErr("User ID atau password salah");
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-9 animate-fade-in">
        <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lift">
          <MapPin className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Selamat datang
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Masuk untuk membuka rencana perjalanan Anda
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
          {loading ? "Memproses..." : "Masuk"}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary-600 hover:text-primary-700"
        >
          Daftar
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Memuat...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
