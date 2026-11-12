import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { useWorkspaceStore, workspaceResourceTarget } from '../../store/workspaceStore';
import { cleanRelationAnnotation, RELATION_LABEL_LIMIT, RELATION_NOTE_LIMIT } from '../../utils/relationAnnotation';
import type { RelationEdge, RelationNode } from '../../utils/relations';
import { buildRelationGraph, relationNodeKey, RELATION_KIND_LABELS } from '../../utils/relations';
import RelationGraph from './RelationGraph';

const PAGE_SIZE = 6;

function RelationDetails({ center, edge }: { center: RelationNode; edge: RelationEdge }) {
  const [label, setLabel] = useState(edge.annotation?.label ?? '');
  const [note, setNote] = useState(edge.annotation?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const dirty = label !== (edge.annotation?.label ?? '') || note !== (edge.annotation?.note ?? '');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !dirty) return;
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
          <input value={label} maxLength={RELATION_LABEL_LIMIT} placeholder="相关" disabled={saving}
            onChange={(event) => { setLabel(event.target.value); setStatus(null); }} />
        </label>
        <label>补充说明（可选）
          <textarea value={note} rows={3} maxLength={RELATION_NOTE_LIMIT} disabled={saving}
            onChange={(event) => { setNote(event.target.value); setStatus(null); }} />
        </label>
        <button type="submit" className="note-button" disabled={saving || !dirty}>{saving ? '保存中…' : '保存关系'}</button>
        {status && <p className="relation-muted" role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      </form>
    </>
  );
}

function RelationView({ center, edges, warning }: { center: RelationNode; edges: RelationEdge[]; warning: boolean }) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const details = useRef<HTMLElement>(null);
  const lastPage = Math.max(0, Math.ceil(edges.length / PAGE_SIZE) - 1);
  const shownPage = Math.min(page, lastPage);
  const visible = edges.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE);
  const edge = visible.find((item) => item.key === selected);
  const movePage = (next: number) => { setPage(next); setSelected(null); };
  const select = (key: string) => {
    setSelected(key);
    if (window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => details.current?.scrollIntoView({ block: 'start' }));
    }
  };

  return (
    <section className="module-card relation-workspace">
      <header className="relation-heading">
        <div><h2>关系视图</h2><p className="relation-muted">{edges.length} 条直接关联</p></div>
        <a className="relation-entry-link" href={center.href} {...workspaceResourceTarget(center.href)}>← 返回当前资料</a>
      </header>
      {warning && <p className="relation-muted" role="alert">部分关联资料暂时无法读取。</p>}
      <div className="relation-layout">
        <div className="relation-graph-area">
          <RelationGraph center={center} edges={visible} selected={selected} select={select} />
          {lastPage > 0 && <div className="relation-pages" aria-label="关系分页">
            <button type="button" onClick={() => movePage(shownPage - 1)} disabled={shownPage === 0}>上一组</button>
            <span>{shownPage + 1} / {lastPage + 1}</span>
            <button type="button" onClick={() => movePage(shownPage + 1)} disabled={shownPage === lastPage}>下一组</button>
          </div>}
        </div>
        <aside ref={details} className="relation-details" id="relation-details" aria-label="连线详情">
          {edge ? <RelationDetails key={edge.key} center={center} edge={edge} /> : <>
            <h3>{edges.length ? '点选一条连线' : '暂无直接关联'}</h3>
            <p className="relation-muted">{edges.length ? '在这里查看和补充关联的含义。点击资料卡片可打开原资料。' : '返回资料页添加关联后，这里会显示对应的节点和连线。'}</p>
          </>}
        </aside>
      </div>
    </section>
  );
}

export default function RelationsWorkspace() {
  const target = useWorkspaceStore((state) => state.relationTarget);
  const logs = useStudyLogStore((state) => state.logs);
  const { version, entries, logLinks, relations, isLoaded: knowledgeLoaded, error: knowledgeError } = useKnowledgeStore();
  const { data: code, isLoaded: codeLoaded, error: codeError } = useProjectCodeStore();
  const graph = useMemo(() => target && buildRelationGraph(target, logs, { version, entries, logLinks, relations }, code), [target, logs, version, entries, logLinks, relations, code]);
  if (graph?.center) return <RelationView key={relationNodeKey(graph.center)} center={graph.center} edges={graph.edges} warning={Boolean(knowledgeError || codeError)} />;
  return (
    <section className="module-card relation-workspace">
      <h2>关系视图</h2>
      <p className="relation-muted">{target && (!knowledgeLoaded || !codeLoaded)
        ? '正在读取关联资料…' : target ? '当前资料无法打开。' : '可从学习日志、知识词条或代码版本进入关系视图。'}</p>
      <a className="relation-entry-link" href="#knowledge">打开知识词条</a>
    </section>
  );
}
