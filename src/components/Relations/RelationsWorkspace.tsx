import { useMemo, useRef, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { knowledgeNetworkHref, useWorkspaceStore, workspaceResourceTarget } from '../../store/workspaceStore';
import type { RelationEdge, RelationNode } from '../../utils/relations';
import { buildRelationGraph, relationNodeKey } from '../../utils/relations';
import RelationDetails from './RelationDetails';
import RelationGraph from './RelationGraph';

const PAGE_SIZE = 6;

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
        <div className="network-actions">
          <a className="relation-entry-link" href={knowledgeNetworkHref(center.kind === 'entry' ? center.id : undefined)}>知识网络</a>
          <a className="relation-entry-link" href={center.href} {...workspaceResourceTarget(center.href)}>← 返回当前资料</a>
        </div>
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
