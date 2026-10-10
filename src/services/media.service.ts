import { put, del, get } from "@vercel/blob";
import { connectDb } from "@/lib/db/mongoose";
import { MEDIA_DEFAULTS } from "@/config/defaults";
import { ResultSubmissionModel } from "@/models/result-submission";
import { SupportEvidenceModel } from "@/models/support-evidence";
import { AppError } from "@/lib/errors";

export async function uploadPrivateMedia(file: File, folder: string) {
  const pathname = `${folder}/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "-")}`;
  const blob = await put(pathname, file, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MEDIA_DEFAULTS.tempRetentionDays);
  return { url: blob.url, pathname: blob.pathname, expiresAt };
}

/** Removes an upload that was rejected before it became usable evidence. */
export async function deletePrivateMedia(pathname: string) {
  await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
}

/** Reads a private image for trusted server-to-server processing. */
export async function getPrivateImageDataUrl(pathname: string) {
  const result = await get(pathname, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new AppError("Uploaded screenshot could not be read.", "MEDIA_NOT_FOUND", 404);
  }
  if (!result.blob.contentType.startsWith("image/")) {
    throw new AppError("Match evidence must be an image.", "INVALID_EVIDENCE", 400);
  }

  const bytes = await new Response(result.stream).arrayBuffer();
  return `data:${result.blob.contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

/** Returns a private image stream for an already-authorized application request. */
export async function getPrivateImage(pathname: string) {
  const result = await get(pathname, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new AppError("Uploaded screenshot could not be read.", "MEDIA_NOT_FOUND", 404);
  }
  if (!result.blob.contentType.startsWith("image/")) {
    throw new AppError("Match evidence must be an image.", "INVALID_EVIDENCE", 400);
  }

  return { stream: result.stream, contentType: result.blob.contentType };
}

export async function purgeExpiredMedia() {
  await connectDb();
  const now = new Date();
  const results = await ResultSubmissionModel.find({
    expiresAt: { $lte: now },
    retainForDispute: { $ne: true },
  });
  const evidence = await SupportEvidenceModel.find({
    expiresAt: { $lte: now },
  });

  let deleted = 0;
  for (const item of [...results, ...evidence]) {
    try {
      await del(item.blobPathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
      await item.deleteOne();
      deleted += 1;
    } catch {
      // Keep the database record so the next cron run retries the Blob deletion.
    }
  }

  return { deleted };
}

export function assertCronSecret(secret: string | null) {
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    throw new AppError("Unauthorized cron request.", "UNAUTHORIZED", 401);
  }
}
