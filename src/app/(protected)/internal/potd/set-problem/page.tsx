import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/utils";
import { redirect } from "next/navigation";
import SetProblemClient from "./SetProblemClient";

export default async function SetProblemPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  const user = session?.user as any;
  if (!user || !isAdmin(user.role)) {
    redirect("/internal/potd");
  }

  return <SetProblemClient />;
}
