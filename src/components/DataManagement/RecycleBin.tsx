import { useEffect, useState } from 'react';
import type { TrashedKnowledgeEntry, TrashedStudyLog } from '../../types';
import type { TrashedCodeVersion } from '../../types/projectCode';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { purgeTrashedResource } from '../../store/recycleBin';
import { useStudyLogStore } from '../../store/studyLogStore';
import { RECYCLE_CATEGORIES, recycleBinHref, useWorkspaceStore } from '../../store/workspaceStore';
import { logLabel } from '../../utils/growth';
import { entryNames } from '../../utils/knowledge';
import { codeVersionHref, codeVersionSource } from '../../utils/projectCode';
import SegmentedControl from '../common/SegmentedControl';
import WorkspaceDialog from '../common/WorkspaceDialog';

type TrashItem = { kind: 'log'; item: TrashedStudyLog } | { kind: 'entry'; item: TrashedKnowledgeEntry }
  | { kind: 'code'; item: TrashedCodeVersion };
const resourceLabels = { log: '学习日志', entry: '词条', code: '代码版本' };
const restoreLabels = { log: '恢复日志', entry: '恢复词条', code: '恢复代码版本' };
const titleFor = (row: TrashItem) => row.kind === 'log' ? logLabel(row.item) : row.kind === 'entry' ? row.item.title : row.item.path;

export default function RecycleBin() {
  const { logs, trashedLogs, restoreLog, error: logError } = useStudyLogStore();
  const { entries, trash, loadKnowledge, restoreEntry, error: entryError } = useKnowledgeStore();
  const { data: code, isLoaded: codeLoaded, restoreVersion, error: codeError } = useProjectCodeStore();
  const category = useWorkspaceStore((state) => state.recycleCategory);
  const [action, setAction] = useState<{ kind: TrashItem['kind']; id: string; type: 'restore' | 'delete' }>();
  const [newDate, setNewDate] = useState('');
  const [title, setTitle] = useState('');
  const [aliases, setAliases] = useState('');
  const [result, setResult] = useState<{ kind: TrashItem['kind']; text: string; href?: string; label?: string }>();
  useEffect(() => { loadKnowledge(); }, [loadKnowledge]);

  const rows: TrashItem[] = [
    ...trashedLogs.map((item) => ({ kind: 'log' as const, item })),
    ...trash.entries.map((item) => ({ kind: 'entry' as const, item })),
    ...code.trash.versions.map((item) => ({ kind: 'code' as const, item })),
  ];
  const visibleRows = rows.filter((row) => row.kind === category).sort((first, second) => second.item.deletedAt - first.item.deletedAt);
  const categoryError = { log: logError, entry: entryError, code: codeError }[category];
  const loading = category === 'code' && !codeLoaded;
  const candidate = rows.find(({ kind, item }) => kind === action?.kind && item.id === action.id);
  const candidateLog = candidate?.kind === 'log' ? candidate.item : undefined;
  const candidateEntry = candidate?.kind === 'entry' ? candidate.item : undefined;
  const candidateCode = candidate?.kind === 'code' ? candidate.item : undefined;
  const archivedProject = candidateCode && code.projects.find((project) => project.id === candidateCode.projectId && project.archived);
  const hasDateConflict = candidateLog && logs.some(({ date }) => date === candidateLog.date);
  const date = hasDateConflict ? newDate : candidateLog?.date ?? '';
  const dateTaken = Boolean(date && logs.some((log) => log.date === date));
  const activeNames = new Set(entries.flatMap(entryNames));
  const hasNameConflict = candidateEntry && entryNames(candidateEntry).some((name) => activeNames.has(name));
  const restoredNames = { title: title.trim(), aliases: aliases === candidateEntry?.aliases.join('，')
    ? candidateEntry.aliases : aliases.split(/[,，\n]/).map((alias) => alias.trim()).filter(Boolean) };
  const names = entryNames(restoredNames);
  const namesValid = Boolean(restoredNames.title) && new Set(names).size === names.length && names.every((name) => !activeNames.has(name));

  const begin = (row: TrashItem, type: 'restore' | 'delete') => {
    setResult(undefined);
    setNewDate('');
    if (row.kind === 'entry') {
      setTitle(row.item.title);
      setAliases(row.item.aliases.join('，'));
    }
    setAction({ kind: row.kind, id: row.item.id, type });
  };

  return <section className="module-card backup-card log-trash" aria-label="回收站">
    <h2>回收站</h2>
    <SegmentedControl as="nav" className="recycle-views" label="回收站分类">
      {RECYCLE_CATEGORIES.map(({ id, label }) => <a key={id} href={recycleBinHref(id)} aria-current={id === category ? 'page' : undefined}>{label}</a>)}
    </SegmentedControl>
    {categoryError && <p role="alert">{categoryError}</p>}
    {result?.kind === category && <p role="status">{result.text}{result.href && <a href={result.href}>{result.label}</a>}。</p>}
    {loading && <p role="status">正在读取代码回收站…</p>}
    {!visibleRows.length && !categoryError && !loading && <p>{rows.length ? `暂无已删除的${resourceLabels[category]}。` : '回收站为空。'}</p>}
    <ul className="log-trash-list">
      {visibleRows.map((row) => <li key={`${row.kind}:${row.item.id}`}>
        <div>
          <strong>{titleFor(row)}</strong>
          {row.kind === 'code' && <div className="knowledge-muted">
            {code.projects.find(({ id }) => id === row.item.projectId)?.name} · {row.item.note || codeVersionSource(row.item)} · 保存于 {new Date(row.item.savedAt).toLocaleString('zh-CN')}
          </div>}
          <div className="knowledge-muted">移入时间 <time dateTime={new Date(row.item.deletedAt).toISOString()}>{new Date(row.item.deletedAt).toLocaleString('zh-CN')}</time></div>
        </div>
        <div className="log-trash-actions">
          <button type="button" className="note-button secondary" disabled={Boolean(categoryError)}
            onClick={() => begin(row, 'restore')}>{restoreLabels[row.kind]}</button>
          <button type="button" className="knowledge-text-button danger" disabled={Boolean(logError || entryError || codeError)}
            onClick={() => begin(row, 'delete')}>彻底删除</button>
        </div>
      </li>)}
    </ul>
    {action?.type === 'restore' && candidateLog && <WorkspaceDialog title="恢复学习日志" action="确认恢复" valid={Boolean(date && !dateTaken)}
      onClose={() => setAction(undefined)} onSave={() => {
        restoreLog(candidateLog.id, date);
        setResult({ kind: 'log', text: '已恢复到 ', href: `#history/${date}`, label: date });
      }}>
      {hasDateConflict ? <>
        <p>{candidateLog.date} 已有学习日志。请选择一个空日期来恢复这篇日志。</p>
        <label className="growth-field">恢复到日期 <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required /></label>
        {dateTaken && <p role="status">该日期已有学习日志。</p>}
      </> : <p>将这篇学习日志恢复到 {candidateLog.date}？</p>}
    </WorkspaceDialog>}
    {action?.type === 'restore' && candidateEntry && <WorkspaceDialog title="恢复词条" action="确认恢复"
      valid={!hasNameConflict || namesValid} onClose={() => setAction(undefined)} onSave={async () => {
        await restoreEntry(candidateEntry.id, hasNameConflict ? restoredNames : undefined);
        setResult({ kind: 'entry', text: '已恢复词条 ', href: `#knowledge/${encodeURIComponent(candidateEntry.id)}`, label: hasNameConflict ? restoredNames.title : candidateEntry.title });
      }}>
      {hasNameConflict ? <>
        <p>名称或别名与现有词条重复。修改后即可恢复词条及其关联。</p>
        <label className="growth-field">词条名称 <input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label className="growth-field">别名（用逗号分隔）<input value={aliases} onChange={(event) => setAliases(event.target.value)} /></label>
      </> : <p>恢复「{candidateEntry.title}」及仍有效的关联？</p>}
    </WorkspaceDialog>}
    {action?.type === 'restore' && candidateCode && <WorkspaceDialog title="恢复代码版本" action="确认恢复"
      onClose={() => setAction(undefined)} onSave={async () => {
        await restoreVersion(candidateCode.id);
        setResult({ kind: 'code', text: '已恢复代码版本 ', href: codeVersionHref(candidateCode.id), label: candidateCode.path });
      }}>
      <p>恢复「{candidateCode.path}」的这个版本及仍有效的关联？</p>
      {archivedProject && <p>所属项目也会回到项目列表。</p>}
    </WorkspaceDialog>}
    {action?.type === 'delete' && candidate && <WorkspaceDialog title={`彻底删除${resourceLabels[candidate.kind]}`} action="确认彻底删除" destructive
      onClose={() => setAction(undefined)} onSave={async () => {
        await purgeTrashedResource(candidate.kind, candidate.item.id);
        setResult({ kind: candidate.kind, text: `${candidate.kind === 'log' ? '日志' : resourceLabels[candidate.kind]}已彻底删除` });
      }}>
      <p>彻底删除「{titleFor(candidate)}」及其关联。{candidate.kind !== 'code' && '其他资料共用的图片会保留。'}此操作无法从回收站恢复。</p>
      {archivedProject && !code.trash.versions.some((version) => version.projectId === archivedProject.id && version.id !== candidateCode?.id)
        && <p>这是「{archivedProject.name}」在回收站中的最后一个版本，项目资料{archivedProject.directory ? '和目录快照' : ''}也会一并删除。</p>}
    </WorkspaceDialog>}
  </section>;
}
