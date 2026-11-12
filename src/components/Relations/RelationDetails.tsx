import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { cleanRelationAnnotation, RELATION_LABEL_LIMIT, RELATION_NOTE_LIMIT } from '../../utils/relationAnnotation';
import type { RelationEdge, RelationNode } from '../../utils/relations';
import { relationNodeKey, RELATION_KIND_LABELS } from '../../utils/relations';

export default function RelationDetails({ center, edge, onRemove, removing }: {
  center: RelationNode;
  edge: RelationEdge;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const [label, setLabel] = useState(edge.annotation?.label ?? '');
  const [note, setNote] = useState(edge.annotation?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const dirty = label !== (edge.annotation?.label ?? '') || note !== (edge.annotation?.note ?? '');
  const busy = saving || removing;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !dirty) return;
    setSaving(true);
    setStatus(null);
    try {
      const input = { label, note };
      const cleaned = cleanRelationAnnotation(input);
      const { origin } = edge;
      const knowledge = useKnowledgeStore.getState();
      if ('linkId' in origin) knowledge.annotateLink(origin.kind, origin.linkId, input);
      else if (origin.kind === 'entry-code') knowledge.annotateEntryCode(origin.ownerId, origin.versionId, input);
      else await useProjectCodeStore.getState().annotateLogCode(origin.versionId, origin.ownerId, input);
      setLabel(cleaned?.label ?? '');
      setNote(cleaned?.note ?? '');
      setStatus({ text: '关系已保存。' });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : '保存失败，请重试。', error: true });
    } finally { setSaving(false); }
  };

  return (
    <>
      <h3 ref={heading} tabIndex={-1}>连线详情</h3>
      <div className="relation-endpoints">
        {[center, edge.node].map((node) => <div key={relationNodeKey(node)} data-kind={node.kind}>
          <span>{RELATION_KIND_LABELS[node.kind]}</span><strong>{node.title}</strong>
        </div>)}
      </div>
      {edge.originalNote && <p className="relation-original-note"><strong>原关联说明</strong>{edge.originalNote}</p>}
      <form className="relation-form" aria-label="编辑关系" onSubmit={(event) => void save(event)}>
        <label>连线标签
          <input value={label} maxLength={RELATION_LABEL_LIMIT} placeholder="相关" disabled={busy}
            onChange={(event) => { setLabel(event.target.value); setStatus(null); }} />
        </label>
        <label>补充说明（可选）
          <textarea value={note} rows={3} maxLength={RELATION_NOTE_LIMIT} disabled={busy}
            onChange={(event) => { setNote(event.target.value); setStatus(null); }} />
        </label>
        <button type="submit" className="note-button" disabled={busy || !dirty}>{saving ? '保存中…' : '保存关系'}</button>
        {status && <p className="relation-muted" role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      </form>
      {onRemove && <button type="button" className="knowledge-text-button danger" disabled={busy} onClick={onRemove}>移除连线</button>}
    </>
  );
}
