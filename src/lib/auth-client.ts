import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    process.env.BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : undefined),
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: false,
  },
  plugins: [
    {
      id: "dev-login",
      endpoints: {
        signInDev: {
          path: "/sign-in/dev",
          method: "POST",
        },
      },
    } as any,
  ],
});

export const { useSession, signIn, signOut } = authClient;
