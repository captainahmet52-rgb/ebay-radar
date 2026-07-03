import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, getClientIpFromHeaders, LOGIN_RATE_LIMIT_MAX } from "@/lib/rate-limit";

// Kullanıcı bulunamadığında da AYNI maliyette bir bcrypt.compare çalıştır → yanıt
// süresi eşitlenir, e-posta enumerate edilemez (timing side-channel kapatılır).
const DUMMY_BCRYPT_HASH = "$2a$12$BfylEKfQqM6qqerS7pC8mOG8G.Ye2KhaBaqzuxONfawcfZHH6M3hK";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "E-posta", type: "email" },
        password: { label: "Şifre",  type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        // BRUTE-FORCE KORUMASI: IP başına login denemesini sınırla (kalıcı Redis sayacı).
        const ip = getClientIpFromHeaders(new Headers(request?.headers as HeadersInit));
        const limit = await rateLimitAsync(`login:${ip}`, LOGIN_RATE_LIMIT_MAX);
        if (!limit.allowed) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({ where: { email } });

        // TIMING-SAFE: kullanıcı yoksa da dummy hash ile compare çalıştır → süre eşit.
        if (!user) {
          await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, plan: user.plan, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.plan = (user as { plan?: string }).plan ?? "starter";
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id   = token.id as string;
        session.user.plan = token.plan as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
