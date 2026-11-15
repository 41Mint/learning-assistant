import { useContext, useEffect, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { StudyLog } from '../../types';
import type { LogReviewSuggestion } from '../../types/logReview';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import FocusEditor from '../common/FocusEditor';
import MarkdownFields from '../common/MarkdownFields';
import LogReviewPanel from './LogReviewPanel';
import { AssistantSlots } from '../Assistant/assistantSlots';
import { isEmptyLogContent } from '../../utils/studyLogs';
import { imageMarkdown, prepareImageFile, referencedImageIds, saveWithImages } from '../../utils/imageStorage';
import type { StoredImage } from '../../utils/imageStorage';

export interface LogEditingProps {
  draft: StudyLog | null;
  setDraft: (draft: StudyLog | null) => void;
}

export default function LogContentEditor({ log, kind, creating = false, onClose }: {
  log: StudyLog;
  kind: 'today' | 'history';
  creating?: boolean;
  onClose: (saved: boolean) => void;
}) {
  const [content, setContent] = useState(log.content);
  const [error, setError] = useState('');
  const [images, setImages] = useState<StoredImage[]>([]);
  const [operation, setOperation] = useState<'pasting' | 'saving'>();
  const inProgress = useRef(false);
  const [review, setReview] = useState<{ selected: LogReviewSuggestion[]; sourceText: string }>();
  const updateLogContent = useStudyLogStore((state) => state.updateLogContent);
  const slots = useContext(AssistantSlots);
  const slot = slots[kind];
  const { setLogDraft } = slots;
  const today = kind === 'today';
  const emptyDraft = creating && isEmptyLogContent(content, log.date);

  useEffect(() => { setLogDraft(kind, { id: log.id, text: content }); }, [kind, log.id, content, setLogDraft]);
  useEffect(() => () => setLogDraft(kind), [kind, setLogDraft]);

  const pasteImages = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboard = event.clipboardData;
    const files = Array.from(clipboard.files).filter((file) => file.type.startsWith('image/'));
    const imageFiles = files.length ? files : Array.from(clipboard.items).flatMap((item) => {
      const file = item.kind === 'file' && item.type.startsWith('image/') ? item.getAsFile() : null;
      return file ? [file] : [];
    });
    if (!imageFiles.length) return;
    event.preventDefault();
    if (inProgress.current) return;
    inProgress.current = true;
    setOperation('pasting');
    setError('');
    const editor = event.currentTarget;
    const before = editor.value.slice(0, editor.selectionStart);
    const after = editor.value.slice(editor.selectionEnd);
    try {
      const prepared = await Promise.all(imageFiles.map(prepareImageFile));
      const markdown = prepared.map(({ id }, index) => imageMarkdown(id, prepared.length === 1 ? '截图' : `截图 ${index + 1}`)).join('\n\n');
      const leadingBreaks = before.match(/\n{0,2}$/)?.[0].length ?? 0;
      const trailingBreaks = after.match(/^\n{0,2}/)?.[0].length ?? 0;
      const prefix = before + (before ? '\n'.repeat(2 - leadingBreaks) : '') + markdown;
      const next = prefix + '\n'.repeat(2 - trailingBreaks) + after;
      setImages((draftImages) => [...draftImages, ...prepared]);
      setContent(next);
      window.requestAnimationFrame(() => {
        if (document.activeElement === editor && editor.value === next) editor.setSelectionRange(prefix.length + 2, prefix.length + 2);
      });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '无法粘贴这张图片，请重试。');
    } finally {
      inProgress.current = false;
      setOperation(undefined);
    }
  };

  const save = async () => {
    if (emptyDraft || inProgress.current) return;
    inProgress.current = true;
    setOperation('saving');
    setError('');
    try {
      if (review?.selected.length && review.sourceText !== content) throw new Error('正文已修改，请重新生成建议，或取消勾选后保存。');
      const referenced = new Set(referencedImageIds(content));
      await saveWithImages(images.filter(({ id }) => referenced.has(id)), () => {
        if (review?.selected.length) useKnowledgeStore.getState().saveReviewedLog(log.id, content, log.content, review.selected, creating ? log : undefined);
        else if (creating) useStudyLogStore.getState().saveLog({ ...log, content });
        else updateLogContent(log.id, content, log.content);
      });
      onClose(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally {
      inProgress.current = false;
      setOperation(undefined);
    }
  };

  return (
    <section className="module-card log-focus-card" aria-label={today ? '今日记录编辑' : '历史记录编辑'}>
      <FocusEditor title={today ? '编辑今日记录' : '编辑历史记录'} description={log.date + ' · 支持 Markdown 和直接粘贴截图。'}
        formLabel={today ? '今日记录编辑表单' : '历史记录编辑表单'} saveLabel={today ? '保存记录' : '保存补充'}
        saveDisabled={emptyDraft || operation === 'pasting'} busy={operation === 'saving'} error={error} onSave={() => void save()} onCancel={() => onClose(false)}>
        <MarkdownFields id={today ? 'study-log-content' : 'history-content'} label={today ? '学习内容（Markdown）' : '历史学习内容'}
          previewLabel={today ? '学习内容实时预览' : '历史学习内容实时预览'} value={content} onChange={setContent}
          placeholder="记录这次学习的内容、疑问或尝试。" images={images} readOnly={Boolean(operation)} onPaste={(event) => void pasteImages(event)} />
        {operation === 'pasting' && <p className="knowledge-muted" role="status">正在读取截图…</p>}
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
