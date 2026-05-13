import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { getClient } from "@/lib/mongodb";
import { APIError } from "better-auth/api";

const client = await getClient();
const db = client.db();

if (!db) {
  throw new Error("MongoDB connection failed");
}

export const auth = betterAuth({
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          throw new APIError("UNAUTHORIZED", {
            message: "Sign up is disabled. Please contact an administrator.",
          });
        },
      },
    },
  },
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
      scope: ["User.Read", "offline_access"],
      prompt: "select_account",
      disableImplicitSignUp: true,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["microsoft"],
    },
  },
});
