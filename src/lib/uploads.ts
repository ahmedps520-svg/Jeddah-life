import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { newId } from "@/lib/auth/password";
import { HttpError } from "@/lib/api";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./data/uploads");
const MAX_BYTES = 4 * 1024 * 1024;

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

/**
 * Validates an uploaded image by its bytes (not its name or MIME header),
 * re-encodes it to WebP at a sensible size and strips all metadata,
 * including any GPS location embedded by the camera.
 */
export async function saveImage(file: File, folder: "reviews" | "submissions" | "avatars" | "places" | "events", maxWidth = 1600) {
  if (file.size > MAX_BYTES) throw new HttpError(413, "too_large");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniff(buf)) throw new HttpError(415, "unsupported_type");
  let out: { data: Buffer; info: { width: number; height: number } };
  try {
    out = await sharp(buf, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: maxWidth, height: maxWidth, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new HttpError(415, "unreadable_image");
  }
  const name = `${newId()}.webp`;
  const dir = path.join(UPLOAD_DIR, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), out.data);
  return { url: `/uploads/${folder}/${name}`, width: out.info.width, height: out.info.height };
}
