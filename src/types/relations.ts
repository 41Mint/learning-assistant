export type RelationNodeKind = 'log' | 'entry' | 'code';

export interface RelationNodeRef {
  kind: RelationNodeKind;
  id: string;
}

export interface RelationAnnotation {
  label: string;
  note: string;
}
