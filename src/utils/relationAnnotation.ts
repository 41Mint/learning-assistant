import type { RelationAnnotation } from '../types/relations';

export const RELATION_LABEL_LIMIT = 12;
export const RELATION_NOTE_LIMIT = 400;

export function isRelationAnnotation(value: unknown): value is RelationAnnotation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { label, note } = value as Record<string, unknown>;
  return typeof label === 'string' && label.length <= RELATION_LABEL_LIMIT
    && typeof note === 'string' && note.length <= RELATION_NOTE_LIMIT;
}

export function cleanRelationAnnotation(input: RelationAnnotation): RelationAnnotation | undefined {
  const label = input.label.trim().replace(/\s+/g, ' ');
  const note = input.note.trim();
  const annotation = { label, note };
  if (!isRelationAnnotation(annotation)) throw new Error('标签或说明超过长度限制。');
  return label || note ? annotation : undefined;
}
