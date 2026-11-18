import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RelationAnnotation } from '../../types/relations';
import { RELATION_LABEL_LIMIT, RELATION_NOTE_LIMIT } from '../../utils/relationAnnotation';
import { relationNodeKey, RELATION_KIND_LABELS } from '../../utils/relations';
import type { RelationNode } from '../../utils/relations';
import SearchableSelect from '../common/SearchableSelect';

function EndpointSelect({ label, nodes, value, disabled, onChange }: {
  label: string;
  nodes: RelationNode[];
  value: string;
  disabled?: boolean;
  onChange: (key: string) => void;
}) {
  const options = (['entry', 'log', 'code'] as const).flatMap((kind) => nodes
    .filter((node) => node.kind === kind)
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
    .map((node) => ({
      id: relationNodeKey(node),
      label: [node.title, node.detail].filter(Boolean).join(' · '),
      fields: [...node.searchFields, RELATION_KIND_LABELS[kind]],
    })));
  return <fieldset className="network-endpoint" disabled={disabled}>
    <SearchableSelect label={label} placeholder={`选择或搜索${label}`} options={options} value={value}
      onChange={(key) => { if (!disabled) onChange(key); }} />
  </fieldset>;
}

export default function NetworkLinkEditor({ first, second, choices, targets, pending, onFirst, onSecond, onSave, onCancel }: {
  first: string;
  second: string;
  choices: RelationNode[];
  targets: RelationNode[];
  pending: boolean;
  onFirst: (key: string) => void;
  onSecond: (key: string) => void;
  onSave: (input: RelationAnnotation) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const canSave = first && targets.some((item) => relationNodeKey(item) === second) && !pending;
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (canSave) onSave({ label, note });
  };
  return <>
    <h3>添加连线</h3>
    <p className="relation-muted">在图中点选起点和终点，也可以搜索资料。</p>
    <form className="relation-form network-link-form" aria-label="添加连线" onSubmit={save}>
      <EndpointSelect label="起点" nodes={choices} value={first} disabled={pending} onChange={onFirst} />
      <EndpointSelect key={first} label="终点" nodes={targets} value={second} disabled={pending || !first} onChange={onSecond} />
      <label>连线标签（可选）
        <input value={label} maxLength={RELATION_LABEL_LIMIT} disabled={pending} placeholder="例如 实现示例" onChange={(event) => setLabel(event.target.value)} />
      </label>
      <label>补充说明（可选）
        <textarea rows={2} value={note} maxLength={RELATION_NOTE_LIMIT} disabled={pending} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="network-actions">
        <button type="submit" className="note-button" disabled={!canSave}>{pending ? '保存中…' : '建立关联'}</button>
        <button type="button" className="note-button secondary" disabled={pending} onClick={onCancel}>取消</button>
      </div>
    </form>
  </>;
}
