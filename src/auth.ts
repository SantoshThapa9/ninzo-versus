import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db/mongoose";
import { userRepository } from "@/repositories/user.repository";
import { isBootstrapAdminEmail } from "@/services/auth.service";
import { UserRole, UserStatus } from "@/types/enums";
import type { UserRole as UserRoleType } from "@/types/enums";

declare module "next-auth" {
  interface User {
    role?: UserRole;
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: UserRole;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials.email ?? "");
        const password = String(credentials.password ?? "");
        const { verifyUser } = await import("@/services/auth.service");
        const user = await verifyUser(email, password);
        if (!user) return null;
        return {
          id: String(user._id),
          email: user.email,
          name: user.displayName,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;

      await connectDb();
      let existing = await userRepository.findByEmail(email);
      const isBootstrapAdmin = isBootstrapAdminEmail(email);
      if (!existing) {
        existing = await userRepository.create({
          email,
          passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
          displayName: user.name || email.split("@")[0],
          role: isBootstrapAdmin ? UserRole.ADMIN : UserRole.USER,
          status: UserStatus.ACTIVE,
          availableCoins: 0,
          lockedCoins: 0,
        });
      } else if (isBootstrapAdmin && existing.role !== UserRole.ADMIN) {
        existing = (await userRepository.updateById(String(existing._id), { role: UserRole.ADMIN })) ?? existing;
      }

      user.id = String(existing._id);
      user.role = existing.role;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user.role ?? "user") as UserRoleType;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id ?? "";
      session.user.role = (token.role ?? "user") as UserRoleType;
      return session;
    },
  },
});
