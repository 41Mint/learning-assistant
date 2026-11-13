import { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StudyLog } from '../../types';
import type { LogReviewSuggestion } from '../../types/logReview';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import FocusEditor from '../common/FocusEditor';
import MarkdownFields from '../common/MarkdownFields';
import LogReviewPanel from './LogReviewPanel';
import { AssistantSlots } from '../Assistant/assistantSlots';

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
  const [review, setReview] = useState<{ selected: LogReviewSuggestion[]; sourceText: string }>();
  const updateLogContent = useStudyLogStore((state) => state.updateLogContent);
  const slots = useContext(AssistantSlots);
  const slot = slots[kind];
  const { setLogDraft } = slots;
  const today = kind === 'today';

  useEffect(() => { setLogDraft(kind, { id: log.id, text: content }); }, [kind, log.id, content, setLogDraft]);
  useEffect(() => () => setLogDraft(kind), [kind, setLogDraft]);
  const save = () => {
    try {
      if (review?.selected.length) {
        if (review.sourceText !== content) throw new Error('正文已修改，请重新生成建议，或取消勾选后保存。');
        useKnowledgeStore.getState().saveReviewedLog(log.id, content, log.content, review.selected);
      } else updateLogContent(log.id, content, log.content);
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
        {!!review?.selected.length && <p className="knowledge-muted">
          {review.sourceText === content ? `已选 ${review.selected.length} 项整理建议，将随日志保存。` : '正文已修改，请在智能体中更新或取消所选建议。'}
        </p>}
      </FocusEditor>
      {slot && createPortal(<LogReviewPanel logId={log.id} content={content} onSelection={(selected, sourceText) => {
          setReview({ selected, sourceText });
          setError('');
      }} />, slot)}
    </section>
  );
}
