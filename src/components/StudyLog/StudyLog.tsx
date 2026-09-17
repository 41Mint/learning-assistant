import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { useStudyLogStore } from '../../store/studyLogStore';

export default function StudyLog() {
  const {
    currentLog,
    isEditing,
    getTodayLog,
    loadLogs,
    updateContent,
    addTag,
    removeTag,
    addKnowledgePoint,
    removeKnowledgePoint,
    startEditing,
    finishEditing,
  } = useStudyLogStore();

  const [newTag, setNewTag] = useState('');
  const [newKnowledge, setNewKnowledge] = useState('');

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          📝 今日学习记录
        </h2>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {currentLog.date} · {currentLog.duration} 分钟
        </div>
      </div>

      {/* Markdown编辑器 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            学习内容（支持Markdown）
          </label>
          {!isEditing && (
            <button
              onClick={startEditing}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              编辑
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="study-log-content"
                  className="block mb-2 text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  编辑
                </label>
                <textarea
                  id="study-log-content"
                  value={currentLog.content}
                  onChange={(e) => updateContent(e.target.value)}
                  className="w-full h-72 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm resize-y"
                  placeholder="记录今天学到的内容..."
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  实时预览
                </p>
                <div className="markdown-preview h-72 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {currentLog.content || '开始输入后，这里会显示 Markdown 效果。'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
            <button
              onClick={finishEditing}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              完成编辑
            </button>
          </div>
        ) : (
          <div className="markdown-preview p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {currentLog.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* 标签 */}
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
}
