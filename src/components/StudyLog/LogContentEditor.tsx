import { useState } from 'react';
import type { StudyLog } from '../../types';
import { useStudyLogStore } from '../../store/studyLogStore';
import FocusEditor from '../common/FocusEditor';
import MarkdownFields from '../common/MarkdownFields';

export interface LogEditingProps {
  draft: StudyLog | null;
  setDraft: (draft: StudyLog | null) => void;
}

export default function LogContentEditor({ log, kind, onClose }: {
  log: StudyLog;
  kind: 'today' | 'history';
  onClose: (saved: boolean) => void;
}) {
  const [content, setContent] = useState(log.content);
  const [error, setError] = useState('');
  const updateLogContent = useStudyLogStore((state) => state.updateLogContent);
  const today = kind === 'today';

  const save = () => {
    try {
      updateLogContent(log.id, content, log.content);
      onClose(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试。');
    }
  };

  return (
    <section className="module-card log-focus-card" aria-label={today ? '今日记录编辑' : '历史记录编辑'}>
      <FocusEditor title={today ? '编辑今日记录' : '编辑历史记录'} description={log.date + ' · 支持 Markdown，可边写边预览。'}
        formLabel={today ? '今日记录编辑表单' : '历史记录编辑表单'} saveLabel={today ? '保存记录' : '保存补充'}
        error={error} onSave={save} onCancel={() => onClose(false)}>
        <MarkdownFields id={today ? 'study-log-content' : 'history-content'} label={today ? '学习内容（Markdown）' : '历史学习内容'}
          previewLabel={today ? '学习内容实时预览' : '历史学习内容实时预览'} value={content} onChange={setContent}
          placeholder="记录这次学习的内容、疑问或尝试。" />
      </FocusEditor>
    </section>
  );
}
