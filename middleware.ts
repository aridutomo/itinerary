export { default } from "next-auth/middleware";

// "/" sengaja TIDAK diproteksi agar splash screen bisa tampil dulu
// untuk user yang belum login, sebelum diarahkan ke /login.
export const config = {
  matcher: ["/dashboard/:path*", "/plan/:path*"],
};
