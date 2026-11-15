import { config } from '../config.js';
import { C } from '../store/index.js';
import { ValidationError } from './validate.js';

export const MAX_PHOTO_BYTES = 400 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

let bucketPromise = null;
async function bucket() {
  if (!config.photoBucket) return null;
  if (!bucketPromise) {
    bucketPromise = import('@google-cloud/storage')
      .then(({ Storage }) => new Storage().bucket(config.photoBucket))
      .catch((err) => {
        console.error('[photos] Cloud Storage unavailable, storing inline:', err.message);
        return null;
      });
  }
  return bucketPromise;
}

/** Decodes and checks a data URL. Verifies magic bytes so a renamed file can't sneak in. */
export function decodeDataUrl(dataUrl, maxBytes = MAX_PHOTO_BYTES) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m || !ALLOWED.has(m[1])) throw new ValidationError('photo: must be a JPEG, PNG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > maxBytes) throw new ValidationError(`photo: image is too large (max ${Math.round(maxBytes / 1024)} KB)`);
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp = buf.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!(isJpeg || isPng || isWebp)) throw new ValidationError('photo: file is not a valid image');
  return { contentType: m[1], buf };
}

const objectName = (circleId, medicineId) => `photos/${circleId}/${medicineId}`;

export async function savePhoto(store, circleId, medicineId, dataUrl) {
  const { contentType, buf } = decodeDataUrl(dataUrl);
  const b = await bucket();
  if (b) {
    await b.file(objectName(circleId, medicineId)).save(buf, { contentType, resumable: false });
    await store.put(C.photos, { id: medicineId, circleId, contentType, location: 'gcs' });
  } else {
    await store.put(C.photos, { id: medicineId, circleId, contentType, location: 'inline', data: buf.toString('base64') });
  }
}

export async function loadPhoto(store, circleId, medicineId) {
  const rec = await store.get(C.photos, medicineId);
  if (!rec || rec.circleId !== circleId) return null;
  if (rec.location === 'gcs') {
    const b = await bucket();
    if (!b) return null;
    const [buf] = await b.file(objectName(circleId, medicineId)).download();
    return { contentType: rec.contentType, buf };
  }
  return { contentType: rec.contentType, buf: Buffer.from(rec.data, 'base64') };
}

export async function deletePhoto(store, circleId, medicineId) {
  const rec = await store.get(C.photos, medicineId);
  if (!rec || rec.circleId !== circleId) return;
  if (rec.location === 'gcs') {
    const b = await bucket();
    await b?.file(objectName(circleId, medicineId)).delete({ ignoreNotFound: true });
  }
  await store.del(C.photos, medicineId);
}
