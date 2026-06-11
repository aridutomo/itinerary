"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function TopBar({ title }: { title: string }) {
  const { data } = useSession();
  const name = data?.user?.name ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Avatar className="h-9 w-9 shadow-sm">
            <AvatarFallback className="bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight text-foreground">
              {title}
            </span>
            {name && (
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                {name}
              </span>
            )}
          </span>
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-3.5 w-3.5" />
          Keluar
        </Button>
      </div>
    </header>
  );
}
