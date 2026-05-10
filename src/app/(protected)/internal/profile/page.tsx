import ProfileForm from "./ProfileForm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }

  return <ProfileForm />;
}
