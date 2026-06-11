"use client";

import Link from "next/link";
import { Calendar, ChevronRight, MapPin, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Trip } from "@/lib/sheets";

function dateRange(mulai: string, selesai: string): string {
  if (!mulai) return "Tanpa tanggal";
  if (!selesai || selesai === mulai) return mulai;
  return `${mulai} – ${selesai}`;
}

export default function TripCard({ trip }: { trip: Trip }) {
  const title =
    trip.nama?.trim() || `${trip.lokasiAsal} → ${trip.lokasiTujuan}`;

  return (
    <Link href={`/trip/${trip.id}`} className="group block">
      <Card className="animate-fade-in p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <Badge
            variant="secondary"
            className="gap-1.5 bg-primary/10 text-primary hover:bg-primary/10"
          >
            <Calendar className="h-3.5 w-3.5" />
            {dateRange(trip.tanggalMulai, trip.tanggalSelesai)}
          </Badge>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>

        <h3 className="mt-2.5 truncate text-base font-semibold text-foreground">
          {title}
        </h3>

        {/* Visualisasi rute asal → tujuan */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-emerald-500" />
            <span className="truncate text-sm text-muted-foreground">
              {trip.lokasiAsal}
            </span>
          </div>
          <span className="h-px flex-1 bg-gradient-to-r from-emerald-300 to-rose-300" />
          <div className="flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />
            <span className="truncate text-sm font-medium text-foreground">
              {trip.lokasiTujuan}
            </span>
          </div>
        </div>

        {(trip.orang.length > 0 || trip.createdBy) && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
            {trip.orang.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="truncate">{trip.orang.join(", ")}</span>
              </span>
            ) : (
              <span />
            )}
            {trip.createdBy && (
              <span className="shrink-0 text-[11px] text-muted-foreground/70">
                oleh {trip.createdBy}
              </span>
            )}
          </div>
        )}
      </Card>
    </Link>
  );
}
