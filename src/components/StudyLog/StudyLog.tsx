import { useEffect, useRef, useState } from 'react';
import CollapsibleNote from '../common/CollapsibleNote';
import MarkdownImport from './MarkdownImport';
import KnowledgeLinks from '../Knowledge/KnowledgeLinks';
import CodeLinksPanel from '../ProjectCode/CodeLinksPanel';
import RelationLink from '../Relations/RelationLink';
import { useStudyLogStore } from '../../store/studyLogStore';
import LogContentEditor from './LogContentEditor';
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
    addKnowledgePoint,
    removeKnowledgePoint,
  } = useStudyLogStore();

  const [newTag, setNewTag] = useState('');
  const [newKnowledge, setNewKnowledge] = useState('');
  const [message, setMessage] = useState('');
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

  const handleAddTag = () => {
    if (newTag.trim()) {
      addTag(newTag.trim());
      setNewTag('');
    }
  };

  const handleAddKnowledge = () => {
    if (newKnowledge.trim()) {
      addKnowledgePoint(newKnowledge.trim());
      setNewKnowledge('');
    }
  };

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

      <MarkdownImport />

      <CollapsibleNote key={currentLog.id} content={currentLog.content} actions={
        <>
          <button ref={editButton} type="button" className="note-button" onClick={() => {
            setMessage('');
            setDraft(currentLog);
          }}>编辑</button>
          <RelationLink kind="log" id={currentLog.id} />
          <TrashLogButton log={currentLog} onMoved={() => setMessage('')} />
        </>
      } />
      {message && <p role="status">{message}</p>}

      {/* 标签 */}
      <KnowledgeLinks logId={currentLog.id} legacyPoints={currentLog.knowledgePoints} />
      <CodeLinksPanel key={currentLog.id + '-code'} target={{ kind: 'log', id: currentLog.id }} title="项目代码" />

      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          标签
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {currentLog.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:text-blue-600 dark:hover:text-blue-300"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="添加标签（如：Unity, C#, 算法）"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
          <button
            onClick={handleAddTag}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            添加
          </button>
        </div>
      </div>

      {/* 知识点 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          学到的知识点
        </label>
        <div className="space-y-2 mb-2">
          {currentLog.knowledgePoints.map((point, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
            >
              <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
              <span className="flex-1 text-gray-800 dark:text-gray-200 text-sm">
                {point}
              </span>
              <button
                onClick={() => removeKnowledgePoint(point)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKnowledge}
            onChange={(e) => setNewKnowledge(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddKnowledge()}
            placeholder="添加学到的知识点"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
          <button
            onClick={handleAddKnowledge}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="module-card study-log-card" hidden={Boolean(draft)}>
      <h2>📝 今日学习记录</h2>
      {error ? <p role="alert">{error}</p> : <>
        <p>今天还没有学习日志。已删除的日志可在<a href="#data">回收站</a>恢复。</p>
        <button ref={editButton} type="button" className="note-button" onClick={() => {
          const log = createTodayLogDraft();
          setMessage('');
          setNewDraftId(log.id);
          setDraft(log);
        }}>写日志</button>
        <MarkdownImport />
        {message && <p role="alert">{message}</p>}
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
    </div>
  );
}
