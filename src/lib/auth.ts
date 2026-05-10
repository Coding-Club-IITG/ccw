import NextAuth, { Session } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { logger } from "@/lib/utils";

const providers: any[] = [
  MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  }),
];

if (process.env.NODE_ENV === "development") {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Development Auto-Login",
      credentials: {},
      async authorize() {
        logger.info("[Auth] Dev login authorize triggered");
        try {
          await dbConnect();
          const devUser = await User.findOne({
            email: "codingclub@iitg.ac.in",
          }).lean();

          if (!devUser) {
            logger.error(
              "[Auth] Dev user 'codingclub@iitg.ac.in' not found in DB",
            );
            return null;
          }

          logger.info("[Auth] Dev user found:", devUser.email);

          // Ensure we return a plain object with plain arrays
          return {
            id: devUser._id.toString(),
            name: devUser.name,
            email: devUser.email,
            role: devUser.role,
            moduleRoles: JSON.parse(JSON.stringify(devUser.moduleRoles || [])),
            codeforcesId: devUser.codeforcesId,
            githubId: devUser.githubId,
            bio: devUser.bio,
            phoneNumber: devUser.phoneNumber,
          };
        } catch (error) {
          logger.error("[Auth] Authorize error:", error);
          return null;
        }
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      logger.info(
        `[Auth] signIn callback: provider=${account?.provider}, email=${user?.email}`,
      );
      if (account?.provider === "dev-login") return true;
      if (!user.email) return false;

      try {
        await dbConnect();
        const existingUser = await User.findOne({ email: user.email });
        if (existingUser) {
          logger.info("[Auth] User whitelisted:", user.email);
          return true;
        }

        logger.warn(`[Auth] Unauthorized login attempt: ${user.email}`);
        return false;
      } catch (error) {
        logger.error("[Auth] signIn callback error:", error);
        return false;
      }
    },
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        await dbConnect();
        const dbUser = await User.findOne({ email: user.email });
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.moduleRoles = JSON.parse(
            JSON.stringify(dbUser.moduleRoles || []),
          );
          token.codeforcesId = dbUser.codeforcesId;
          token.githubId = dbUser.githubId;
          token.bio = dbUser.bio;
          token.phoneNumber = dbUser.phoneNumber;
        }
      }

      // Handle session updates (trigger="update")
      if (trigger === "update" && session) {
        token.name = session.name;
        token.codeforcesId = session.codeforcesId;
        token.githubId = session.githubId;
        token.bio = session.bio;
        token.phoneNumber = session.phoneNumber;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.moduleRoles = token.moduleRoles as any;
        session.user.codeforcesId = token.codeforcesId as string;
        session.user.githubId = token.githubId as string;
        session.user.bio = token.bio as string;
        session.user.phoneNumber = token.phoneNumber as string;
      }
      return session;
    },
  },
});
