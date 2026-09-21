import { put, del } from "@vercel/blob";
import { connectDb } from "@/lib/db/mongoose";
import { getPlatformSettings } from "@/services/settings.service";
import { ResultSubmissionModel } from "@/models/result-submission";
import { SupportEvidenceModel } from "@/models/support-evidence";
import { AppError } from "@/lib/errors";

export async function uploadPrivateMedia(file: File, folder: string) {
  const pathname = `${folder}/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "-")}`;
  const blob = await put(pathname, file, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  const settings = await getPlatformSettings();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + settings.mediaRetentionDays);
  return { url: blob.url, pathname: blob.pathname, expiresAt };
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
    retainForDispute: { $ne: true },
  });

  for (const item of [...results, ...evidence]) {
    try {
      await del(item.blobPathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // continue deleting remaining objects
    }
  }

  await ResultSubmissionModel.deleteMany({
    expiresAt: { $lte: now },
    retainForDispute: { $ne: true },
  });
  await SupportEvidenceModel.deleteMany({
    expiresAt: { $lte: now },
    retainForDispute: { $ne: true },
  });

  return { deleted: results.length + evidence.length };
}

export function assertCronSecret(secret: string | null) {
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    throw new AppError("Unauthorized cron request.", "UNAUTHORIZED", 401);
  }
}
