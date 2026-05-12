import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "Secretary" | "OC" | "Core Team" | "Member";
      moduleRoles: {
        module:
          | "Software Development"
          | "Competitive Programming"
          | "Machine Learning"
          | "Cybersecurity"
          | "Design";
        role: "Head" | "Senior Coordinator" | "Coordinator" | "Member";
      }[];
      codeforcesId?: string;
      githubId?: string;
      bio?: string;
      phoneNumber?: string;
      msAccessToken?: string;
      msRefreshToken?: string;
      msTokenExpiresAt?: Date;
    } & DefaultSession["user"];
  }

  interface User {
    role: "Secretary" | "OC" | "Core Team" | "Member";
    moduleRoles: {
      module:
        | "Software Development"
        | "Competitive Programming"
        | "Machine Learning"
        | "Cybersecurity"
        | "Design";
      role: "Head" | "Senior Coordinator" | "Coordinator" | "Member";
    }[];
    codeforcesId?: string;
    githubId?: string;
    bio?: string;
    phoneNumber?: string;
    msAccessToken?: string;
    msRefreshToken?: string;
    msTokenExpiresAt?: Date;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "Secretary" | "OC" | "Core Team" | "Member";
    moduleRoles: {
      module:
        | "Software Development"
        | "Competitive Programming"
        | "Machine Learning"
        | "Cybersecurity"
        | "Design";
      role: "Head" | "Senior Coordinator" | "Coordinator" | "Member";
    }[];
    codeforcesId?: string;
    githubId?: string;
    bio?: string;
    phoneNumber?: string;
    msAccessToken?: string;
    msRefreshToken?: string;
    msTokenExpiresAt?: Date;
  }
}
