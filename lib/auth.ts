import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyUser, type SessionUser } from "@/lib/sheets";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        userid: { label: "User ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.userid || !credentials?.password) return null;
        const found = await verifyUser(credentials.userid, credentials.password);
        if (!found) return null;
        return { id: found.id, name: found.nama || found.namaLengkap || found.id };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.uid as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
};

// Ambil user yang sedang login (id + nama tampilan) dari sesi server.
// Mengembalikan null bila belum login.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; name?: string | null } | undefined;
  if (!user?.id) return null;
  return { id: user.id, name: user.name ?? null };
}
