import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.BASE_URL,
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: false,
  },
});

export const { useSession, signIn, signOut } = authClient;
