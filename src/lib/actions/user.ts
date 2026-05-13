"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils";
import { isAdmin } from "@/lib/roles";

async function checkAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session || !isAdmin((session.user as any).role)) {
    logger.warn(
      `Unauthorized admin access attempt by: ${session?.user?.email || "Unknown"}`,
    );
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getUsers() {
  await checkAdmin();
  await dbConnect();
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  return JSON.parse(JSON.stringify(users));
}

export async function addUser(email: string, name?: string) {
  const adminSession = await checkAdmin();
  await dbConnect();

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("User already exists");
  }

  const newUser = await User.create({
    email,
    name: name || email.split("@")[0],
    role: "Member",
    moduleRoles: [],
  });

  logger.info(`Admin ${adminSession.user.email} added user: ${email}`);
  revalidatePath("/admin");
  return JSON.parse(JSON.stringify(newUser));
}

export async function updateUserRole(userId: string, role: string) {
  const adminSession = await checkAdmin();
  await dbConnect();

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true },
  );

  logger.info(
    `Admin ${adminSession.user.email} updated role of ${updatedUser.email} to ${role}`,
  );
  revalidatePath("/admin");
  return JSON.parse(JSON.stringify(updatedUser));
}

export async function updateUserModuleRoles(
  userId: string,
  moduleRoles: any[],
) {
  const adminSession = await checkAdmin();
  await dbConnect();

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { moduleRoles },
    { new: true },
  );

  logger.info(
    `Admin ${adminSession.user.email} updated module roles of ${updatedUser.email}`,
  );
  revalidatePath("/admin");
  return JSON.parse(JSON.stringify(updatedUser));
}

export async function deleteUser(userId: string) {
  const adminSession = await checkAdmin();
  await dbConnect();

  const userToDelete = await User.findById(userId);
  if (userToDelete) {
    logger.warn(
      `Admin ${adminSession.user.email} deleted user: ${userToDelete.email}`,
    );
    await User.findByIdAndDelete(userId);
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function updateProfile(data: {
  name: string;
  codeforcesId?: string;
  githubId?: string;
  bio?: string;
  phoneNumber?: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  await dbConnect();
  const updatedUser = await User.findByIdAndUpdate(
    session.user.id,
    {
      name: data.name,
      codeforcesId: data.codeforcesId || "",
      githubId: data.githubId || "",
      bio: data.bio || "",
      phoneNumber: data.phoneNumber || "",
    },
    { new: true },
  );

  logger.info(`User ${session.user.email} updated their profile`);
  revalidatePath("/internal/dashboard");
  return JSON.parse(JSON.stringify(updatedUser));
}
