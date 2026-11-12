import { useEffect, useRef, useState } from 'react';
import CollapsibleNote from '../common/CollapsibleNote';
import MarkdownImport from './MarkdownImport';
import KnowledgeLinks from '../Knowledge/KnowledgeLinks';
import CodeLinksPanel from '../ProjectCode/CodeLinksPanel';
import RelationLink from '../Relations/RelationLink';
import { useStudyLogStore } from '../../store/studyLogStore';
import LogContentEditor from './LogContentEditor';
import type { LogEditingProps } from './LogContentEditor';

export default function StudyLog({ draft, setDraft }: LogEditingProps) {
  const {
    currentLog,
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
  const editButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadLogs();
    getTodayLog();
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

  if (!currentLog) {
    return <div>加载中...</div>;
  }

  const reading = (
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
  );

  return (
    <div>
      {draft && <LogContentEditor key={draft.id} log={draft} kind="today" onClose={(saved) => {
        setDraft(null);
        if (saved) setMessage('学习记录已保存。');
        window.requestAnimationFrame(() => editButton.current?.focus());
      }} />}
      {reading}
    </div>
  );
}
