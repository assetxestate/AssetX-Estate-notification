import { supabase } from "./supabase";

export const VALUATION_IMAGE_BUCKET = "valuation-images";
export const VALUATION_IMAGE_LIMIT = 12;

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.78;

function safePathSegment(value) {
  return String(value || "asset")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "asset";
}

function imageToBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    };
    img.src = url;
  });
}

export async function compressValuationImage(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("รองรับเฉพาะไฟล์รูปภาพ");
  }

  const img = await imageToBitmap(file);
  const ratio = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * ratio));
  const height = Math.max(1, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("บีบอัดรูปไม่สำเร็จ"));
    }, "image/jpeg", JPEG_QUALITY);
  });

  return { blob, width, height };
}

export async function uploadValuationPropertyImage(file, context = {}) {
  const { blob, width, height } = await compressValuationImage(file);
  const assessmentDate = safePathSegment(context.assessmentDate || new Date().toISOString().slice(0, 10));
  const assetCode = safePathSegment(context.assetCode || context.projectName || "draft");
  const originalName = safePathSegment(file.name || "property-image");
  const path = `${assessmentDate}/${assetCode}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${originalName}.jpg`;

  const { error } = await supabase.storage
    .from(VALUATION_IMAGE_BUCKET)
    .upload(path, blob, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`อัปโหลดรูปเข้า Supabase ไม่สำเร็จ: ${error.message}`);
  }

  const { data } = supabase.storage.from(VALUATION_IMAGE_BUCKET).getPublicUrl(path);

  return {
    url: data.publicUrl,
    path,
    fileName: file.name || "property-image.jpg",
    contentType: "image/jpeg",
    originalSize: file.size || 0,
    compressedSize: blob.size,
    width,
    height,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteValuationPropertyImage(image) {
  if (!image?.path) return { success: false, skipped: true };
  const { error } = await supabase.storage
    .from(VALUATION_IMAGE_BUCKET)
    .remove([image.path]);
  if (error) throw error;
  return { success: true };
}
