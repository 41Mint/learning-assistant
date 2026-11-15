import { useState } from 'react';
import { useStudyLogStore } from '../../store/studyLogStore';
import { purgeTrashedLog } from '../../store/logTrash';
import { logLabel } from '../../utils/growth';
import WorkspaceDialog from '../common/WorkspaceDialog';

export default function LogTrash() {
  const { logs, trashedLogs, restoreLog, error } = useStudyLogStore();
  const [restoreId, setRestoreId] = useState<string>();
  const [newDate, setNewDate] = useState('');
  const [restoredDate, setRestoredDate] = useState('');
  const [deleteId, setDeleteId] = useState<string>();
  const [deleted, setDeleted] = useState(false);
  const candidate = trashedLogs.find(({ id }) => id === restoreId);
  const deleteCandidate = trashedLogs.find(({ id }) => id === deleteId);
  const hasConflict = candidate && logs.some(({ date }) => date === candidate.date);
  const date = hasConflict ? newDate : candidate?.date ?? '';
  const dateTaken = Boolean(date && logs.some((log) => log.date === date));

  return <section className="module-card backup-card log-trash" aria-label="回收站">
    <h2>回收站</h2>
    {error && <p role="alert">{error}</p>}
    {restoredDate && <p role="status">已恢复到 <a href={`#history/${restoredDate}`}>{restoredDate}</a>。</p>}
    {deleted && <p role="status">日志已彻底删除。</p>}
    {trashedLogs.length === 0 && !error && <p>回收站里没有学习日志。</p>}
    <ul className="log-trash-list">
      {[...trashedLogs].sort((a, b) => b.deletedAt - a.deletedAt).map((log) => (
        <li key={log.id}>
          <div>
            <strong>{logLabel(log)}</strong>
            <time className="knowledge-muted" dateTime={new Date(log.deletedAt).toISOString()}>移入时间 {new Date(log.deletedAt).toLocaleString('zh-CN')}</time>
          </div>
          <div className="log-trash-actions">
            <button type="button" className="note-button secondary" disabled={Boolean(error)} onClick={() => {
              setRestoreId(log.id);
              setNewDate('');
              setRestoredDate('');
              setDeleted(false);
            }}>恢复日志</button>
            <button type="button" className="knowledge-text-button danger" disabled={Boolean(error)} onClick={() => {
              setDeleteId(log.id);
              setRestoredDate('');
              setDeleted(false);
            }}>彻底删除</button>
          </div>
        </li>
      ))}
    </ul>
    {candidate && <WorkspaceDialog title="恢复学习日志" action="确认恢复" valid={Boolean(date && !dateTaken)} onClose={() => setRestoreId(undefined)} onSave={() => {
      restoreLog(candidate.id, date);
      setRestoredDate(date);
    }}>
      {hasConflict ? <>
        <p>{candidate.date} 已有学习日志。请选择一个空日期来恢复这篇日志。</p>
        <label className="growth-field">恢复到日期 <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required /></label>
        {dateTaken && <p role="status">该日期已有学习日志。</p>}
      </> : <p>将这篇学习日志恢复到 {candidate.date}？</p>}
    </WorkspaceDialog>}
    {deleteCandidate && <WorkspaceDialog title="彻底删除学习日志" action="确认彻底删除" destructive
      onClose={() => setDeleteId(undefined)} onSave={async () => {
        await purgeTrashedLog(deleteCandidate.id);
        setDeleted(true);
      }}>
      <p>彻底删除「{logLabel(deleteCandidate)}」及其关联，其他资料共用的图片会保留。此操作无法从回收站恢复。</p>
    </WorkspaceDialog>}
  </section>;
}
