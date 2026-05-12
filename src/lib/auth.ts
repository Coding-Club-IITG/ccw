import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { getClient } from "@/lib/mongodb";

const client = await getClient();
const db = client.db();

if (!db) {
  throw new Error("MongoDB connection failed");
}

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.BASE_URL,
  user: {
    modelName: "users",
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "Member",
      },
      moduleRoles: {
        type: "string",
      },
      codeforcesId: {
        type: "string",
      },
      githubId: {
        type: "string",
      },
      bio: {
        type: "string",
      },
      phoneNumber: {
        type: "string",
      },
    },
  },
  socialProviders: {
    microsoft: {
      clientId: process.env.AZURE_CLIENT_ID as string,
      clientSecret: process.env.AZURE_CLIENT_SECRET as string,
      tenantId: process.env.AZURE_TENANT_ID as string,
    },
  },
  plugins: [
    {
      id: "dev-login",
      endpoints: {
        signInDev: createAuthEndpoint(
          "/sign-in/dev",
          {
            method: "POST",
            useSession: false,
          },
          async (ctx) => {
            if (process.env.NEXT_PUBLIC_DEV_BYPASS !== "1") {
              return ctx.json(
                { message: "Dev bypass disabled" },
                { status: 403 },
              );
            }

            const user = await db
              .collection("users")
              .findOne({ email: "codingclub@iitg.ac.in" });

            if (!user) {
              return ctx.json(
                { message: "Dev user not found" },
                { status: 404 },
              );
            }

            const session = await ctx.context.internalAdapter.createSession(
              user._id.toString(),
            );

            await setSessionCookie(ctx, {
              session,
              user: {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                image: user.image,
              } as any,
            });

            return ctx.json({
              session,
              user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                image: user.image,
                role: user.role,
                moduleRoles: user.moduleRoles,
                codeforcesId: user.codeforcesId,
                githubId: user.githubId,
                bio: user.bio,
                phoneNumber: user.phoneNumber,
              },
            });
          },
        ),
      },
    },
  ],
});
