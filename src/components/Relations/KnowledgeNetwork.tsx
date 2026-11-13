import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { entryEditSnapshot, sameEntryEdit, useKnowledgeStore } from '../../store/knowledgeStore';
import type { EntryCategoryChange, SaveKnowledgeEntry } from '../../store/knowledgeStore';
import { canConnectNetworkNodes, connectNetworkNodes, removeNetworkConnection } from '../../store/networkRelations';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { useWorkspaceStore, workspaceResourceTarget } from '../../store/workspaceStore';
import type { RelationAnnotation } from '../../types/relations';
import { compareKnowledgeModules, emptyNetworkLayout, filterKnowledgeSelection, focusKnowledgeNetwork,
  renameModuleOffset, visibleKnowledgeNetwork } from '../../utils/knowledgeNetwork';
import type { NetworkLayers, NetworkLayoutEdits } from '../../utils/knowledgeNetwork';
import { cleanRelationAnnotation } from '../../utils/relationAnnotation';
import { buildRelationNetwork, relationLabel, relationNodeKey } from '../../utils/relations';
import type { RelationConnection, RelationNode } from '../../utils/relations';
import { matchesWords, searchWords } from '../../utils/resourceSearch';
import { IS_KNOWLEDGE_DEMO, KNOWLEDGE_DEMO_HREF } from '../../utils/workspaceMode';
import KnowledgeDirectory from '../Knowledge/KnowledgeDirectory';
import KnowledgeEditor from '../Knowledge/KnowledgeEditor';
import KnowledgeNetworkCanvas from './KnowledgeNetworkCanvas';
import type { KnowledgeNetworkCanvasHandle } from './KnowledgeNetworkCanvas';
import ModuleComparisonDetails from './ModuleComparisonDetails';
import NetworkCategoryEditor from './NetworkCategoryEditor';
import type { CategoryEditorTarget } from './NetworkCategoryEditor';
import NetworkLinkEditor from './NetworkLinkEditor';
import NetworkToolbar from './NetworkToolbar';
import RelationDetails from './RelationDetails';
import RelationLink from './RelationLink';
import { useNetworkHistory } from './useNetworkHistory';
import type { HistoryDirection } from './useNetworkHistory';

type LinkDraft = { first: string; second: string };
type EditorTarget = { kind: 'entry'; id?: string } | CategoryEditorTarget;
type BatchScope = 'all' | 'direct' | 'intermediate';
interface BatchSelection { keys: Set<string>; scope: BatchScope; detailKey?: string }
interface KeyboardLock {
  lock: (codes: string[]) => Promise<void>;
  unlock: () => void;
}
const CATEGORY_EDITOR_TITLES = { rename: '重命名分类', members: '整理模块成员', batch: '批量改分类' };

export default function KnowledgeNetwork({ active }: { active: boolean }) {
  const { version, entries, logLinks, relations, isLoaded, error } = useKnowledgeStore();
  const logs = useStudyLogStore((state) => state.logs);
  const code = useProjectCodeStore((state) => state.data);
  const codeError = useProjectCodeStore((state) => state.error);
  const entryRequest = useWorkspaceStore((state) => state.networkEntryRequest);
  const [handledEntryRequest, setHandledEntryRequest] = useState<typeof entryRequest>(null);
  const [moduleSelection, setModuleSelection] = useState<string[] | null>(null);
  const [crossOnly, setCrossOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [layers, setLayers] = useState<NetworkLayers>({ log: true, code: true });
  const [hops, setHops] = useState(0);
  const [nodeKey, setNodeKey] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchSelection | null>(null);
  const [layoutEdits, setLayoutEdits] = useState(emptyNetworkLayout);
  const [focusRequest, setFocusRequest] = useState(0);
  const [connectionKey, setConnectionKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const { available: historyAvailable, record, run: runHistory } = useNetworkHistory();
  const workspace = useRef<HTMLElement>(null);
  const canvas = useRef<KnowledgeNetworkCanvasHandle>(null);
  const sidebar = useRef<HTMLElement>(null);
  const editor = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === workspace.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  useEffect(() => {
    if (active) return;
    if (editor.current?.open) editor.current.close();
    if (document.fullscreenElement && document.fullscreenElement === workspace.current) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, [active]);
  useEffect(() => {
    const dialog = editor.current;
    if (!active || !fullscreen || !editorTarget || !dialog?.open) return;
    const keyboard = (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
    if (typeof keyboard?.lock !== 'function' || typeof keyboard.unlock !== 'function') return;
    let escapePressed = false;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented) return;
      escapePressed = true;
      event.preventDefault();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !escapePressed) return;
      escapePressed = false;
      if (event.isComposing || event.defaultPrevented) return;
      // Keep the lock until the browser has dispatched the release of the same key.
      event.preventDefault();
      dialog.close();
    };
    dialog.addEventListener('keydown', handleKeyDown);
    dialog.addEventListener('keyup', handleKeyUp);
    void keyboard.lock(['Escape']).catch(() => undefined);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      dialog.removeEventListener('keyup', handleKeyUp);
      keyboard.unlock();
    };
  }, [active, fullscreen, editorTarget]);
  const performHistory = useCallback((direction: HistoryDirection) => {
    if (!active || pending || draft || canvas.current?.interacting() || document.querySelector('dialog[open]')) return false;
    try {
      const label = runHistory(direction);
      if (!label) return false;
      setNotice({ text: `${direction === 'undo' ? '已撤销' : '已重做'}${label}。` });
    } catch (failure) {
      setNotice({ text: failure instanceof Error ? failure.message : '画布操作未能恢复。', error: true });
    }
    return true;
  }, [active, pending, draft, runHistory]);
  useEffect(() => {
    if (!active) return;
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented || event.isComposing) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable], [role="textbox"]')) return;
      const key = event.key.toLowerCase();
      const direction = key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' && !event.shiftKey ? 'redo' : null;
      if (direction && performHistory(direction)) event.preventDefault();
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [active, performHistory]);

  const network = useMemo(() => buildRelationNetwork(logs, { version, entries, logLinks, relations }, code), [logs, version, entries, logLinks, relations, code]);
  const allNodes = useMemo(() => [...network.nodes.values()], [network]);
  const categories = useMemo(() => [...new Set(entries.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [entries]);
  const visibleModules = useMemo(() => moduleSelection === null ? categories : categories.filter((category) => moduleSelection.includes(category)),
    [categories, moduleSelection]);
  const moduleScope = moduleSelection === null ? null : visibleModules;
  const selected = nodeKey ? network.nodes.get(nodeKey) : undefined;
  const revealed = moduleScope !== null || crossOnly || selected?.kind === 'entry' ? undefined : selected;
  const first = draft ? network.nodes.get(draft.first) : undefined;
  const second = draft ? network.nodes.get(draft.second) : undefined;
  const available = useMemo(() => visibleKnowledgeNetwork(network.nodes, network.connections, moduleScope, layers, revealed),
    [network, moduleScope, layers, revealed]);
  const showComparison = crossOnly || visibleModules.length >= 2 && visibleModules.length < categories.length;
  const comparison = useMemo(() => showComparison ? compareKnowledgeModules(available, visibleModules) : null,
    [showComparison, available, visibleModules]);
  const base = crossOnly && comparison ? comparison.cross : available;
  const node = selected && base.nodes.includes(selected) ? selected : undefined;
  const batchKeys = batch?.keys;
  const batchScope = batch?.scope ?? 'all';
  const selectionOnly = batchScope !== 'all';
  const visible = useMemo(() => {
    const scoped = crossOnly ? base : focusKnowledgeNetwork(base, node, hops);
    if (batchKeys && batchScope !== 'all') return filterKnowledgeSelection(scoped, batchKeys, batchScope === 'intermediate');
    const endpoints = [first, second].filter((item): item is RelationNode => Boolean(item && !scoped.nodes.includes(item)));
    return endpoints.length ? {
      ...scoped,
      nodes: [...scoped.nodes, ...endpoints],
      entries: [...scoped.entries, ...endpoints.filter((item) => item.kind === 'entry')],
    } : scoped;
  }, [base, crossOnly, node, hops, batchKeys, batchScope, first, second]);
  const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const batchNodes = batchKeys ? visible.nodes.filter((item) => batchKeys.has(relationNodeKey(item))) : [];
  const batchVisibleKeys = new Set(batchNodes.map(relationNodeKey));
  const batchEntryIds = batchNodes.flatMap((item) => item.kind === 'entry' ? [item.id] : []);
  const editorEntry = editorTarget?.kind === 'entry' && editorTarget.id ? entriesById.get(editorTarget.id) : undefined;
  const linkedToFirst = new Set(first ? network.connections.flatMap((item) => item.first === first ? [item.second] : item.second === first ? [item.first] : []) : []);
  const secondChoices = first ? allNodes.filter((item) => canConnectNetworkNodes(first, item) && !linkedToFirst.has(item)) : [];
  const words = searchWords(query);
  const results = words.length ? (first ? secondChoices : allNodes).filter((item) => matchesWords(item.searchFields, words)) : [];
  const matches = words.length ? new Set(results.map(relationNodeKey)) : null;
  const connection = visible.connections.find((item) => item.key === connectionKey);
  const inspected = batch?.detailKey ? network.nodes.get(batch.detailKey) : undefined;
  const detailNode = batch ? (inspected && visible.nodes.includes(inspected) ? inspected : undefined) : node;
  const direct = detailNode ? visible.connections.filter(({ first, second }) => first === detailNode || second === detailNode) : [];
  const aliases = detailNode?.kind === 'entry' ? entriesById.get(detailNode.id)?.aliases : undefined;
  const logCount = visible.nodes.filter((item) => item.kind === 'log').length;
  const codeCount = visible.nodes.filter((item) => item.kind === 'code').length;

  const revealSidebar = () => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => sidebar.current?.scrollIntoView({ block: 'nearest' }));
    }
  };
  const clearSelection = () => {
    setBatch(null);
    setNodeKey(null);
    setConnectionKey(null);
    setHops(0);
  };
  const resetFilterView = () => {
    clearSelection();
    setNotice(null);
    canvas.current?.fit();
  };
  const setModules = (next: string[] | null) => {
    setModuleSelection(next && categories.every((category) => next.includes(category)) ? null : next);
  };
  const changeModules = (next: string[] | null) => {
    setModules(next);
    resetFilterView();
  };
  const revealEntryModules = (modules: string[]) => {
    if (moduleSelection !== null && modules.some((module) => !visibleModules.includes(module))) {
      setModules([...new Set([...visibleModules, ...modules])]);
    }
  };
  const locateNode = (item: RelationNode) => {
    if (item.kind === 'entry') revealEntryModules([item.detail ?? '']);
    else {
      const layer = item.kind;
      const nextLayers = layers[layer] ? layers : { ...layers, [layer]: true };
      const candidates = layers === nextLayers ? available : visibleKnowledgeNetwork(network.nodes, network.connections, moduleScope, nextLayers);
      if (!candidates.nodes.includes(item)) setModuleSelection(null);
      if (crossOnly && !base.nodes.includes(item)) setCrossOnly(false);
      setLayers(nextLayers);
    }
    setHops(0);
    setBatch(null);
    setNodeKey(relationNodeKey(item));
    setFocusRequest((current) => current + 1);
    setConnectionKey(null);
    setDraft(null);
    setNotice(null);
  };

  if (active && isLoaded && !pending && entryRequest && handledEntryRequest !== entryRequest) {
    setHandledEntryRequest(entryRequest);
    const entry = network.nodes.get(relationNodeKey({ kind: 'entry', id: entryRequest.id }));
    if (entry) locateNode(entry);
  }
  const selectNode = (item: RelationNode) => {
    if (pending) return;
    const key = relationNodeKey(item);
    setNotice(null);
    if (draft) {
      if (!first) setDraft({ first: key, second: '' });
      else if (linkedToFirst.has(item)) setNotice({ text: '这两份资料已经有关联。', error: true });
      else if (canConnectNetworkNodes(first, item)) {
        setDraft({ ...draft, second: key });
        revealSidebar();
      }
      else setNotice({ text: '请选择另一个可关联的节点。', error: true });
    } else if (selectionOnly && batch) {
      setBatch({ ...batch, detailKey: key });
      setConnectionKey(null);
    } else {
      setBatch(null);
      setNodeKey(key);
      setConnectionKey(null);
    }
  };
  const changeBatch = (keys: string[], toggle = false) => {
    if (draft || pending) return;
    const next = new Set(batchKeys ?? (node ? [relationNodeKey(node)] : []));
    for (const key of keys) {
      if (toggle && next.has(key)) next.delete(key);
      else next.add(key);
    }
    if (next.size) {
      setBatch({ keys: next, scope: batchScope });
      setConnectionKey(null);
      setNotice(null);
    } else clearSelection();
  };
  const changeBatchScope = (scope: BatchScope) => {
    if (!batch) return;
    setBatch({ keys: batch.keys, scope });
    setConnectionKey(null);
    setNotice(null);
    if (scope !== 'all') canvas.current?.fitSelection();
  };
  const selectConnection = (item: RelationConnection) => {
    if (draft || pending) return;
    setConnectionKey(item.key);
    if (!selectionOnly) setBatch(null);
    setNotice(null);
    revealSidebar();
  };
  const dismissDetails = () => {
    if (draft || pending || (!connection && !batch?.detailKey)) return;
    setConnectionKey(null);
    if (batch?.detailKey) setBatch({ ...batch, detailKey: undefined });
    setNotice(null);
  };
  const openNode = (item: RelationNode) => {
    if (draft || pending) return;
    if (workspaceResourceTarget(item.href).target) window.open(item.href, '_blank', 'noopener');
    else window.location.hash = item.href;
  };
  const cancelLink = () => {
    setDraft(null);
    setNotice(null);
  };
  const toggleLink = () => {
    if (draft) { cancelLink(); return; }
    setDraft({ first: node && !batchNodes.length ? relationNodeKey(node) : '', second: '' });
    setBatch(null);
    setConnectionKey(null);
    setNotice(null);
  };
  const createLink = async (input: RelationAnnotation) => {
    if (!first || !second || !secondChoices.includes(second) || pending) return;
    setPending(true);
    setNotice(null);
    try {
      await connectNetworkNodes(first, second, cleanRelationAnnotation(input));
      const kinds = [first.kind, second.kind];
      setLayers((current) => ({ log: current.log || kinds.includes('log'), code: current.code || kinds.includes('code') }));
      const entryModules = [first, second].flatMap((item) => item.kind === 'entry' ? [item.detail ?? ''] : []);
      if (entryModules.length) revealEntryModules(entryModules);
      else if (!available.nodes.includes(first) || !available.nodes.includes(second)) setModuleSelection(null);
      if (crossOnly && (entryModules.length !== 2 || entryModules[0] === entryModules[1])) setCrossOnly(false);
      setHops(0);
      setNodeKey(relationNodeKey(first));
      setFocusRequest((current) => current + 1);
      setDraft(null);
      setNotice({ text: '连线已建立。' });
    } catch (failure) {
      setNotice({ text: failure instanceof Error ? failure.message : '建立连线失败。', error: true });
    } finally { setPending(false); }
  };
  const removeLink = async (item: RelationConnection) => {
    if (pending || !window.confirm(`移除「${item.first.title}」与「${item.second.title}」的连线？`)) return;
    setPending(true);
    setNotice(null);
    try {
      await removeNetworkConnection(item.origin);
      setConnectionKey(null);
      setNotice({ text: '连线已移除。' });
    } catch (failure) {
      setNotice({ text: failure instanceof Error ? failure.message : '移除连线失败。', error: true });
    } finally { setPending(false); }
  };
  const toggleFullscreen = async () => {
    const section = workspace.current;
    if (!section) return;
    try {
      if (document.fullscreenElement === section) await document.exitFullscreen();
      else await section.requestFullscreen();
    } catch { setNotice({ text: '当前浏览器窗口无法进入全屏。', error: true }); }
  };
  const openEditor = (target: EditorTarget) => {
    if (draft || pending || editor.current?.open) return;
    setNotice(null);
    setEditorTarget(target);
    editor.current?.showModal();
  };
  const closeEditor = () => editor.current?.close();
  const newEntry = () => openEditor({ kind: 'entry' });
  const entrySaved = (id: string) => {
    if (editorTarget?.kind === 'entry' && !editorTarget.id) {
      const entry = useKnowledgeStore.getState().entries.find((item) => item.id === id);
      if (entry) revealEntryModules([entry.category]);
      setHops(0);
      setBatch(null);
      setNodeKey(relationNodeKey({ kind: 'entry', id }));
      setFocusRequest((current) => current + 1);
      setConnectionKey(null);
    }
    setNotice({ text: '词条已保存。' });
    closeEditor();
  };
  const commitLayout = (next: NetworkLayoutEdits, label: string) => {
    if (next === layoutEdits) return;
    setLayoutEdits(next);
    record({ label, undo: () => setLayoutEdits(layoutEdits), redo: () => setLayoutEdits(next) });
    setNotice(null);
  };
  const keepMovedEntriesVisible = (changes: Pick<EntryCategoryChange, 'from' | 'to'>[]) => {
    const moved = changes.filter(({ from, to }) => from !== to);
    if (!moved.length) return;
    setModuleSelection((previous) => {
      if (previous === null) return previous;
      const destinations = moved.filter(({ from }) => previous.includes(from)).map(({ to }) => to);
      return destinations.length ? [...new Set([...previous, ...destinations])] : previous;
    });
  };
  const saveInlineEntry: SaveKnowledgeEntry = (input, options) => {
    const store = useKnowledgeStore.getState();
    const before = options?.id ? entryEditSnapshot(store, options.id) : undefined;
    const id = store.saveEntry(input, options);
    const after = entryEditSnapshot(useKnowledgeStore.getState(), id);
    if (before && after && !sameEntryEdit(before, after)) {
      const forward = { from: before.entry.category, to: after.entry.category };
      const backward = { from: forward.to, to: forward.from };
      keepMovedEntriesVisible([forward]);
      record({
        label: '编辑词条',
        undo: () => {
          useKnowledgeStore.getState().restoreEntryEdit(after, before);
          keepMovedEntriesVisible([backward]);
        },
        redo: () => {
          useKnowledgeStore.getState().restoreEntryEdit(before, after);
          keepMovedEntriesVisible([forward]);
        },
      });
    }
    return id;
  };
  const saveCategories = (target: CategoryEditorTarget, ids: string[], to: string) => {
    const store = useKnowledgeStore.getState();
    const current = new Map(store.entries.map((entry) => [entry.id, entry]));
    const changes = ids.map((id) => {
      const entry = current.get(id);
      if (!entry || (target.kind !== 'batch' && entry.category !== target.category)) {
        throw new Error('词条或分类已有变化，请重新打开编辑。');
      }
      return { id, from: entry.category, to };
    });
    const inverse = changes.map(({ id, from, to }) => ({ id, from: to, to: from }));
    const nextLayout = target.kind === 'rename' ? renameModuleOffset(layoutEdits, target.category, to, categories.includes(to)) : layoutEdits;
    const apply = (changes: EntryCategoryChange[], layout: NetworkLayoutEdits) => {
      useKnowledgeStore.getState().applyEntryCategories(changes);
      keepMovedEntriesVisible(changes);
      setLayoutEdits(layout);
    };
    apply(changes, nextLayout);
    record({
      label: CATEGORY_EDITOR_TITLES[target.kind],
      undo: () => apply(inverse, layoutEdits),
      redo: () => apply(changes, nextLayout),
    });
    setNotice({ text: `已更新 ${changes.length} 个词条的分类。` });
    closeEditor();
  };
  const editorLabel = editorTarget?.kind === 'entry' ? (editorTarget.id ? '在画布中编辑词条' : '在画布中新建词条')
    : editorTarget ? CATEGORY_EDITOR_TITLES[editorTarget.kind] : undefined;

  return (
    <section ref={workspace} className="module-card network-workspace" onKeyDown={(event) => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing && draft && !pending && !editor.current?.open) cancelLink();
    }}>
      <header className="relation-heading">
        <div>
          <h2>知识网络</h2>
          {visible.nodes.length > 0 && <p className="relation-muted">
            {visible.entries.length} 个词条 · {visible.connections.length} 条关联
            {layers.log && ` · ${logCount} 条日志`}
            {layers.code && ` · ${codeCount} 个代码版本`}
          </p>}
        </div>
        <div className="network-actions">
          {isLoaded && !entries.length && !error && <a className="relation-entry-link" href="#knowledge">打开词条目录</a>}
          {!IS_KNOWLEDGE_DEMO && <a className="relation-entry-link" href={KNOWLEDGE_DEMO_HREF} target="_blank" rel="noopener">打开知识网络演示</a>}
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {!error && !isLoaded && <p className="relation-muted">正在读取知识词条…</p>}
      {!error && isLoaded && <>
        {layers.code && codeError && <p className="relation-muted" role="alert">部分代码资料暂时无法读取。</p>}
        <div className="network-layout">
          <KnowledgeNetworkCanvas ref={canvas} nodes={visible.nodes} connections={visible.connections}
            selectedNode={detailNode} selectedKeys={batchVisibleKeys} selectionOnly={selectionOnly} edits={layoutEdits} onLayoutEdit={commitLayout}
            selectedConnection={connection} focusRequest={focusRequest} matches={matches} connecting={draft ? { first, second } : undefined}
            onNode={selectNode} onOpenNode={openNode} onConnection={selectConnection} onBlankClick={dismissDetails} onNewEntry={newEntry}
            onEditEntry={(id) => openEditor({ kind: 'entry', id })}
            onRenameModule={(category) => openEditor({ kind: 'rename', category })}
            onEditMembers={(category) => openEditor({ kind: 'members', category })}
            onToggleSelection={(item) => changeBatch([relationNodeKey(item)], true)}
            onBoxSelection={changeBatch}
            onHideModule={(module) => changeModules(visibleModules.filter((item) => item !== module))}
            onOnlyModule={(module) => changeModules([module])}
            onHideLayer={(layer) => setLayers((current) => ({ ...current, [layer]: false }))}
            toolbar={<NetworkToolbar query={query} results={results} onQuery={setQuery} onLocate={draft ? selectNode : locateNode}
              layers={layers} categories={categories} visibleModules={visibleModules} crossOnly={crossOnly} hops={node ? hops : 0} canFocus={Boolean(node)}
              onToggleLayer={(layer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
              onModules={changeModules} onCrossOnly={(checked) => { setCrossOnly(checked); resetFilterView(); }}
              onHops={(next) => { setHops(next); setConnectionKey(null); }}
              linkStep={draft ? (second ? '填写关系说明' : first ? '选择终点' : '选择起点') : undefined}
              linkDisabled={pending || allNodes.length < 2} onToggleLink={toggleLink} onNewEntry={newEntry}
              historyAvailable={historyAvailable} onHistory={performHistory}
              fullscreen={fullscreen} onFullscreen={() => void toggleFullscreen()} />} />
          <aside ref={sidebar} className="relation-details network-sidebar" aria-label="知识网络详情">
            {notice && <p className="relation-muted" role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
            {!draft && (detailNode || connection) && <button type="button" className="network-directory-back" onClick={() => {
              if (connection && (detailNode || selectionOnly)) setConnectionKey(null);
              else if (batch && selectionOnly) setBatch({ ...batch, detailKey: undefined });
              else clearSelection();
            }}>{connection && detailNode ? '← 节点详情' : selectionOnly ? '← 所选节点' : comparison ? '← 跨模块关联' : '← 词条目录'}</button>}
            {draft ? <NetworkLinkEditor first={draft.first} second={draft.second} choices={allNodes} targets={secondChoices} pending={pending}
                onFirst={(key) => {
                  setDraft({ first: key, second: '' });
                  setNotice(null);
                }} onSecond={(key) => {
                  setDraft({ ...draft, second: key });
                  setNotice(null);
                }} onSave={(input) => void createLink(input)} onCancel={cancelLink} />
              : connection ? <RelationDetails key={connection.key} center={connection.first} edge={{ ...connection, node: connection.second }}
              removing={pending} onRemove={() => void removeLink(connection)} />
              : detailNode ? <>
                <h3>{detailNode.title}</h3>
                {detailNode.detail && <p className="relation-muted">{detailNode.detail}</p>}
                {!!aliases?.length && <p className="relation-muted">别名 {aliases.join('、')}</p>}
                <div className="network-actions">
                  <a className="relation-entry-link" href={detailNode.href} {...workspaceResourceTarget(detailNode.href)}>{detailNode.kind === 'entry' ? '打开词条' : '打开原资料'}</a>
                  <RelationLink kind={detailNode.kind} id={detailNode.id} />
                </div>
                <h4>图中关联（{direct.length}）</h4>
                {direct.length ? <ul className="network-neighbors">
                  {direct.map((item) => {
                    const neighbor = item.first === detailNode ? item.second : item.first;
                    return <li key={item.key}>
                      <button type="button" className="network-neighbor-name" onClick={() => selectNode(neighbor)}>{neighbor.title}</button>
                      <button type="button" className="network-neighbor-label" aria-label={`查看与 ${neighbor.title} 的关系（${relationLabel(item)}）`}
                        onClick={() => selectConnection(item)}>{relationLabel(item)}</button>
                    </li>;
                  })}
                </ul> : <p className="relation-muted">当前图中没有与此节点相连的资料。</p>}
              </> : batchKeys ? <>
                <h3>已选 {batchNodes.length} 个节点</h3>
                {batchNodes.length > 0 ? <ul className="network-selection-list">
                  {batchNodes.map((item) => <li key={relationNodeKey(item)}>{item.title}</li>)}
                </ul> : <p className="relation-muted">当前范围内没有可见的所选节点。</p>}
                {selectionOnly && <div className="network-selection-options">
                  <label className="network-filter-option" title="显示没有直连的所选节点之间经过一个中间节点的路径">
                    <input type="checkbox" checked={batchScope === 'intermediate'} disabled={batchNodes.length < 2}
                      onChange={(event) => changeBatchScope(event.target.checked ? 'intermediate' : 'direct')} />
                    显示中间节点（两跳）
                  </label>
                  {batchScope === 'intermediate' && <p className="relation-muted">中间节点 {visible.nodes.length - batchNodes.length} 个</p>}
                  {batchNodes.length >= 2 && !visible.connections.length && <p className="relation-muted">
                    {batchScope === 'direct' ? '所选节点之间没有直接连线。' : '当前范围内没有可显示的连线。'}
                  </p>}
                </div>}
                <div className="network-actions">
                  <button type="button" className="note-button" disabled={!selectionOnly && !batchNodes.length}
                    onClick={() => changeBatchScope(selectionOnly ? 'all' : 'direct')}>{selectionOnly ? '返回完整视图' : '仅查看所选'}</button>
                  <button type="button" className="note-button secondary" disabled={!batchEntryIds.length}
                    onClick={() => openEditor({ kind: 'batch', ids: batchEntryIds })}>批量改分类（{batchEntryIds.length} 个词条）</button>
                  <button type="button" className="note-button secondary" onClick={clearSelection}>清除选择</button>
                </div>
              </> : comparison && visibleModules.length >= 2 ? <ModuleComparisonDetails comparison={comparison} onConnection={selectConnection} onNode={locateNode} />
              : crossOnly ? <><h3>跨模块关联</h3><p className="relation-muted">显示至少两个模块可查看它们之间的联系。</p></> : <>
                <h3>词条目录（{visible.entries.length}）</h3>
                {visible.entries.length ? <KnowledgeDirectory items={visible.entries} categoryOf={(item) => item.detail ?? ''}
                  renderEntry={(item) => <button type="button" onClick={() => selectNode(item)}><strong>{item.title}</strong></button>} />
                  : <p className="relation-muted">{entries.length ? '当前没有可见模块。可在图层与筛选中恢复显示。' : '可用画布上的新建按钮添加词条。'}</p>}
              </>}
          </aside>
        </div>
      </>}
      <dialog ref={editor} className="network-entry-editor" data-category-editor={editorTarget && editorTarget.kind !== 'entry' || undefined}
        aria-label={editorLabel} onClose={() => setEditorTarget(null)}>
        {editorTarget?.kind === 'entry' && (editorTarget.id && !editorEntry
          ? <><p role="alert">这个词条已不存在。</p><button type="button" className="note-button secondary" onClick={closeEditor}>关闭</button></>
          : <KnowledgeEditor key={editorTarget.id ?? 'new'} entry={editorEntry} categories={categories}
            initialCategory={visibleModules.length === 1 ? visibleModules[0] : undefined} saveEntry={saveInlineEntry} onSave={entrySaved} onCancel={closeEditor} />)}
        {editorTarget && editorTarget.kind !== 'entry' && <NetworkCategoryEditor title={CATEGORY_EDITOR_TITLES[editorTarget.kind]} target={editorTarget} categories={categories}
          entries={editorTarget.kind === 'batch' ? entries.filter((entry) => editorTarget.ids.includes(entry.id))
            : entries.filter((entry) => entry.category === editorTarget.category)}
          onSave={(ids, category) => saveCategories(editorTarget, ids, category)} onCancel={closeEditor} />}
      </dialog>
    </section>
  );
}
