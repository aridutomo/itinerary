"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MapPin } from "lucide-react";

// Lama minimal splash tampil (ms), supaya tidak "berkedip" saat sesi
// resolve cepat. Atur sesuai durasi animasi yang Anda buat.
const MIN_SPLASH_MS = 2000;

export default function SplashPage() {
  const router = useRouter();
  const { status } = useSession();
  const [minElapsed, setMinElapsed] = useState(false);

  // Tahan splash minimal MIN_SPLASH_MS.
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Setelah waktu minimal lewat & status sesi diketahui, arahkan.
  useEffect(() => {
    if (!minElapsed || status === "loading") return;
    router.replace(status === "authenticated" ? "/dashboard" : "/login");
  }, [minElapsed, status, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      {/* ===== Area branding — silakan tambahkan animasi di sini ===== */}
      <div className="flex animate-fade-in flex-col items-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lift">
          <MapPin className="h-10 w-10" />
        </span>

        <h1 className="mt-6 bg-gradient-to-br from-primary-600 to-primary-800 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Itinerary
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Rencana perjalanan pribadi
        </p>
      </div>
      {/* ============================================================ */}

      {/* Indikator loading kecil di bawah */}
      <div className="absolute bottom-12 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" />
      </div>
    </div>
  );
}
