import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      await dbConnect();

      // Whitelist
      const existingUser = await User.findOne({ email: user.email });
      if (existingUser) return true;

      console.warn(`Unauthorized login attempt: ${user.email}`);
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role || "Member";
        token.moduleRoles = user.moduleRoles || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.moduleRoles = token.moduleRoles as any;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
