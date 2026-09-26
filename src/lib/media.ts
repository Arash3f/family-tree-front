import { getApiBaseUrl } from "@/lib/api";

/**
 * Browser URL for a person photo.
 *
 * The API returns a time-limited signed path on `photo_url` (e.g.
 * `/media/persons/….jpg?exp=…&sig=…`). Prefix with the same-origin API base
 * (`/backend`) so the browser never talks to MinIO.
 */
export function resolvePersonPhotoUrl(
  photoUrl: string | null | undefined,
): string | null {
  const trimmed = photoUrl?.trim();
  if (!trimmed || !trimmed.startsWith("/")) return null;

  const base = getApiBaseUrl();
  if (trimmed.startsWith(base)) return trimmed;
  return `${base}${trimmed}`;
}
