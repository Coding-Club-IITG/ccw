/**
 * GET  /api/files  — list all files the current user can access
 * POST /api/files  — upload a new file
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import FileEntry from "@/models/FileEntry";
import { canUploadFiles, canAccessFile } from "@/lib/fileAccess";
import { parseModuleRoles, getHeadModules, isAdmin } from "@/lib/roles";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "@/lib/utils";

export const runtime = "nodejs";

// Configuration

const UPLOAD_DIR =
  process.env.FILE_UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

async function ensureUploadDir(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    logger.info(`[Files] Created upload directory: ${UPLOAD_DIR}`);
  }
}

// GET /api/files

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const moduleRoles = parseModuleRoles(user.moduleRoles);

  await dbConnect();

  // Fetch all files, filter in-process
  // storedName (UUID disk path) is deliberately excluded — it must never leave the server
  // All file serving is proxied through /api/files/[id]
  const allFiles = await FileEntry.find({})
    .select("-storedName")
    .sort({ createdAt: -1 })
    .lean();

  const accessible = allFiles.filter((file) =>
    canAccessFile(user.id, user.role, moduleRoles, file as any),
  );

  return NextResponse.json({ files: accessible });
}

// POST /api/files

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const moduleRoles = parseModuleRoles(user.moduleRoles);

  if (!canUploadFiles(user.role)) {
    return NextResponse.json(
      { error: "Only admins and module heads can upload files." },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Failed to parse form data. Check Content-Type header." },
      { status: 400 },
    );
  }

  // Extract fields

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const description =
    (formData.get("description") as string | null)?.trim() ?? "";
  const folder = (formData.get("folder") as string | null)?.trim() || "General";
  const isDownloadable = formData.get("isDownloadable") === "true";

  const uploaderModuleRaw = formData.get("uploaderModule") as string | null;
  let uploaderModule: string | null = null;

  if (uploaderModuleRaw && uploaderModuleRaw !== "null") {
    const headModules = getHeadModules(user.role, moduleRoles);
    if (isAdmin(user.role)) {
      uploaderModule = uploaderModuleRaw;
    } else if (headModules.includes(uploaderModuleRaw)) {
      uploaderModule = uploaderModuleRaw;
    } else {
      return NextResponse.json(
        { error: "You cannot upload files under that module." },
        { status: 403 },
      );
    }
  }

  let accessControl;
  try {
    const raw = formData.get("accessControl") as string | null;
    accessControl = raw ? JSON.parse(raw) : null;
  } catch {
    accessControl = null;
  }

  const defaultAcl = {
    allMembers: false,
    allowedModules: [],
    allowedGlobalRoles: [],
    allowedModuleRoles: [],
    allowedUsers: [],
  };
  accessControl = { ...defaultAcl, ...accessControl };

  // Save to disk

  const originalExt = path.extname(file.name).toLowerCase();
  const storedName = `${crypto.randomUUID()}${originalExt}`;

  try {
    await ensureUploadDir();
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
  } catch (err) {
    logger.error("[Files] Disk write error:", err);
    return NextResponse.json(
      { error: "Failed to save file to disk." },
      { status: 500 },
    );
  }

  // Persist metadata

  try {
    await dbConnect();
    const newFile = await FileEntry.create({
      title,
      description,
      originalName: file.name,
      storedName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      folder,
      uploadedBy: user.id,
      uploadedByName: user.name,
      uploaderModule,
      isDownloadable,
      accessControl,
    });

    logger.info(
      `[Files] ${user.email} uploaded "${title}" (${file.size} bytes)`,
    );
    return NextResponse.json({ file: newFile }, { status: 201 });
  } catch (err) {
    // Best-effort cleanup of the disk file if DB write fails
    try {
      const { unlink } = await import("fs/promises");
      await unlink(path.join(UPLOAD_DIR, storedName));
    } catch {}

    logger.error("[Files] DB write error:", err);
    return NextResponse.json(
      { error: "Failed to save file metadata." },
      { status: 500 },
    );
  }
}
