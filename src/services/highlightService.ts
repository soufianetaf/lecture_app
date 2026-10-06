import { db, type Highlight, type HighlightAnchor, type HighlightColor } from '../db/db';

export interface NewHighlight {
  bookId: string;
  anchor: HighlightAnchor;
  text: string;
  color: HighlightColor;
  label?: string;
}

export async function addHighlight(input: NewHighlight): Promise<Highlight> {
  const now = Date.now();
  const highlight: Highlight = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await db.highlights.add(highlight);
  return highlight;
}

/** Change la couleur et/ou la note. Une note vide est supprimée. */
export async function updateHighlight(id: string, patch: { color?: HighlightColor; note?: string }): Promise<void> {
  const changes: Partial<Highlight> = { updatedAt: Date.now() };
  if (patch.color) changes.color = patch.color;
  if (patch.note !== undefined) changes.note = patch.note.trim() || undefined;
  await db.highlights.update(id, changes);
}

export async function deleteHighlight(id: string): Promise<void> {
  await db.highlights.delete(id);
}

export function getHighlights(bookId: string): Promise<Highlight[]> {
  return db.highlights.where('bookId').equals(bookId).toArray();
}
