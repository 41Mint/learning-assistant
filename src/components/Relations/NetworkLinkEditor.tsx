import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RelationAnnotation } from '../../types/relations';
import { RELATION_LABEL_LIMIT, RELATION_NOTE_LIMIT } from '../../utils/relationAnnotation';
import { relationNodeKey, RELATION_KIND_LABELS } from '../../utils/relations';
import type { RelationNode } from '../../utils/relations';
import { matchesWords, searchWords } from '../../utils/resourceSearch';

function EndpointSelect({ label, nodes, value, disabled, onChange }: {
  label: string;
  nodes: RelationNode[];
  value: string;
  disabled?: boolean;
  onChange: (key: string) => void;
}) {
  const [query, setQuery] = useState('');
  const words = searchWords(query);
  const choices = nodes.filter((node) => relationNodeKey(node) === value || matchesWords(node.searchFields, words));
  return <fieldset className="network-endpoint" disabled={disabled}>
    <legend>{label}</legend>
    <input type="search" aria-label={'搜索' + label} placeholder={'搜索' + label} value={query} onChange={(event) => setQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        if (words.length && choices.length === 1) onChange(relationNodeKey(choices[0]));
      }} />
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{choices.length ? '选择资料' : '没有匹配的资料'}</option>
      {(['entry', 'log', 'code'] as const).map((kind) => {
        const group = choices.filter((node) => node.kind === kind).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
        return group.length ? <optgroup key={kind} label={RELATION_KIND_LABELS[kind]}>
          {group.map((node) => <option key={relationNodeKey(node)} value={relationNodeKey(node)}>{[node.title, node.detail].filter(Boolean).join(' · ')}</option>)}
        </optgroup> : null;
      })}
    </select>
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
