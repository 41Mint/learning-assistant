import { useEffect, useRef, useState } from 'react';
import CollapsibleNote from '../common/CollapsibleNote';
import useMarkdownImport from './useMarkdownImport';
import KnowledgeLinks from '../Knowledge/KnowledgeLinks';
import CodeLinksPanel from '../ProjectCode/CodeLinksPanel';
import RelationLink from '../Relations/RelationLink';
import { useStudyLogStore } from '../../store/studyLogStore';
import LogContentEditor from './LogContentEditor';
import LogMetadataField from './LogMetadataField';
import type { LogEditingProps } from './LogContentEditor';
import TrashLogButton from './TrashLogButton';
import { getTodayDate, STORAGE_KEYS } from '../../utils/storage';
import { createTodayLogDraft } from '../../utils/studyLogs';

export default function StudyLog({ draft, setDraft }: LogEditingProps) {
  const {
    currentLog,
    error,
    getTodayLog,
    loadLogs,
    addTag,
    removeTag,
    renameTag,
    addKnowledgePoint,
    removeKnowledgePoint,
  } = useStudyLogStore();

  const [message, setMessage] = useState('');
  const [importResult, setImportResult] = useState<{ date: string; imageCount: number }>();
  const [newDraftId, setNewDraftId] = useState<string>();
  const editButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadLogs();
    const state = useStudyLogStore.getState();
    if (!state.error && !state.currentLog && !state.trashedLogs.some(({ date }) => date === getTodayDate())) {
      try { getTodayLog(); } catch { /* The store exposes the write error. */ }
    }
    const reload = (event: StorageEvent) => { if (event.key === STORAGE_KEYS.STUDY_LOGS || event.key === null) loadLogs(); };
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, [getTodayLog, loadLogs]);

  const { trigger: importButton, dialog: importDialog } = useMarkdownImport({
    onOpen: () => setImportResult(undefined),
    onImported: (date, imageCount) => {
      setMessage('');
      setImportResult({ date, imageCount });
    },
  });
  const importNotice = importResult && <p className="knowledge-muted" role="status">
    已保存到 {importResult.date} 的学习记录，共 {importResult.imageCount} 张图片。<a href={`#history/${importResult.date}`}>查看日志</a>
  </p>;

  const reading = currentLog ? (
    <div className="module-card study-log-card bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6" hidden={Boolean(draft)}>
      <div className="study-log-heading flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          📝 今日学习记录
        </h2>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {currentLog.date} · {currentLog.duration} 分钟
        </div>
      </div>

      <div className="log-reading">
        <CollapsibleNote key={currentLog.id} content={currentLog.content} actions={
          <>
            {importButton}
            <button ref={editButton} type="button" className="note-button" onClick={() => {
              setMessage('');
              setImportResult(undefined);
              setDraft(currentLog);
            }}>编辑</button>
            <RelationLink kind="log" id={currentLog.id} />
            <TrashLogButton log={currentLog} onMoved={() => { setMessage(''); setImportResult(undefined); }} />
          </>
        } />
        {message && <p role="status">{message}</p>}
        {importNotice}
        <KnowledgeLinks logId={currentLog.id} legacyPoints={currentLog.knowledgePoints} />
        <CodeLinksPanel key={currentLog.id + '-code'} target={{ kind: 'log', id: currentLog.id }} title="项目代码" />

        <div className="log-metadata">
          <LogMetadataField key={currentLog.id} label="标签" placeholder="例如 Unity、C#、算法" items={currentLog.tags}
            onAdd={addTag} onRemove={removeTag} onRename={(previous, next) => renameTag(currentLog.id, previous, next)} />
          <LogMetadataField label="学到的知识点" placeholder="添加学到的知识点" items={currentLog.knowledgePoints}
            onAdd={addKnowledgePoint} onRemove={removeKnowledgePoint} />
        </div>
      </div>
    </div>
  ) : (
    <div className="module-card study-log-card" hidden={Boolean(draft)}>
      <h2>📝 今日学习记录</h2>
      {error ? <p role="alert">{error}</p> : <>
        <p>今天还没有学习日志。已删除的日志可在<a href="#data">回收站</a>恢复。</p>
        <div className="history-note-actions">
          {importButton}
          <button ref={editButton} type="button" className="note-button" onClick={() => {
            const log = createTodayLogDraft();
            setMessage('');
            setImportResult(undefined);
            setNewDraftId(log.id);
            setDraft(log);
          }}>写日志</button>
        </div>
        {message && <p role="alert">{message}</p>}
        {importNotice}
      </>}
    </div>
  );

  return (
    <div>
      {draft && <LogContentEditor key={draft.id} log={draft} kind="today" creating={draft.id === newDraftId} onClose={(saved) => {
        setDraft(null);
        setNewDraftId(undefined);
        if (saved) setMessage('学习记录已保存。');
        window.requestAnimationFrame(() => editButton.current?.focus());
      }} />}
      {reading}
      {importDialog}
    </div>
  );
}
