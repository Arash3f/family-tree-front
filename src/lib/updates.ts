/** Keys for landing + in-app «What's new» copy (newest first in messages). */
export const UPDATE_KEYS = [
  "u1",
  "u2",
  "u3",
  "u4",
  "u5",
  "u6",
  "u7",
  "u8",
] as const;

export type UpdateKey = (typeof UPDATE_KEYS)[number];

/** Visible items per page on landing and in the updates dialog. */
export const UPDATES_PAGE_SIZE = 3;
