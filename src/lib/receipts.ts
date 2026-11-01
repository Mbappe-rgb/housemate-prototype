import { supabase } from './supabase'

const BUCKET = 'receipts'
const MAX_BYTES = 5 * 1024 * 1024
const MAX_SIDE = 1600

export class ReceiptError extends Error {}

/**
 * Shrink photos before upload (the free plan has limited storage): longest side 1600px, JPEG.
 * PDFs and images the browser can't read (e.g. HEIC outside Safari) are uploaded as they are.
 */
export async function compressReceipt(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/** Upload a receipt to {household}/{bill}/{me}-{time}.{ext}. Returns the storage path. */
export async function uploadReceipt(householdId: string, billId: string, userId: string, file: File): Promise<string> {
  const body = await compressReceipt(file)
  if (body.size > MAX_BYTES) throw new ReceiptError('That file is over 5 MB. Try a smaller photo or PDF.')
  const type = body.type || file.type
  const ext = type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type.includes('hei') ? 'heic' : 'jpg'
  const path = `${householdId}/${billId}/${userId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: false })
  if (error) {
    throw new ReceiptError(
      /mime|type/i.test(error.message) ? 'Receipts can be photos or PDFs.' : 'The receipt didn’t upload. Check your connection and try again.',
    )
  }
  return path
}

/** Open a receipt through a link that works for 60 seconds. */
export async function openReceipt(path: string): Promise<boolean> {
  // Open the tab right away (inside the tap) so phones don't block it, then point it at the file
  const tab = window.open('', '_blank')
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !data) {
    tab?.close()
    return false
  }
  if (tab) tab.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return true
}
