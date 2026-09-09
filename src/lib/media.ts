import { getApiBaseUrl } from "@/lib/api";

/**
 * Browser URL for a person photo.
 *
 * The API returns a time-limited signed path on `photo_url` (e.g.
 * `/media/persons/….jpg?exp=…&sig=…`). Those are same-origin via `/backend`
 * so the browser never talks to MinIO directly.
 */
export function resolvePersonPhotoUrl(
  photoUrl: string | null | undefined,
  _photoObjectKey?: string | null,
): string | null {
  const trimmed = photoUrl?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const base = getApiBaseUrl();
  if (trimmed.startsWith(base)) return trimmed;
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return trimmed;
}
