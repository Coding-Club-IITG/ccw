import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { getClient } from "@/lib/mongodb";
import { APIError } from "better-auth/api";
import { ObjectId } from "mongodb";
import { logger } from "../lib/utils";

const client = await getClient();
const db = client.db();

if (!db) {
  throw new Error("MongoDB connection failed");
}

export const auth = betterAuth({
  /**
   * Block ALL implicit user creation
   * Users must be pre-created by an admin
   */
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          logger.warn(
            `[Auth] Blocked implicit user creation for: ${user.email}`,
          );
          throw new APIError("UNAUTHORIZED", {
            message:
              "Sign-up is disabled. Please contact an administrator to get access.",
          });
        },
      },
    },

    session: {
      create: {
        before: async (session) => {
          let _id: ObjectId | string;
          try {
            _id = new ObjectId(session.userId);
          } catch {
            _id = session.userId;
          }

          const approvedUser = await db
            .collection("users")
            .findOne({ _id } as object);

          if (!approvedUser) {
            logger.warn(
              `[Auth] Blocked session creation for non-approved user: ${session.userId}`,
            );
            throw new APIError("UNAUTHORIZED", {
              message:
                "Access denied. You are not authorised to use this application. Contact an administrator.",
            });
          }
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
