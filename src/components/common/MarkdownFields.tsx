import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEventHandler, Ref } from 'react';
import type { StoredImage } from '../../utils/imageStorage';
import { formatMarkdown } from '../../utils/markdownEditing';
import type { HeadingLevel, MarkdownEdit, MarkdownFormat } from '../../utils/markdownEditing';
import MarkdownContent from './MarkdownContent';
import type { MarkdownLinkRenderer } from './MarkdownContent';
import MarkdownToolbar from './MarkdownToolbar';

export interface MarkdownEditorHandle {
  insertAfterSelection: (text: string, separatorWhenSelected?: string) => boolean;
}

interface MarkdownFieldsProps {
  id: string;
  label: string;
  previewLabel: string;
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  images?: StoredImage[];
  readOnly?: boolean;
  onPaste?: ClipboardEventHandler<HTMLTextAreaElement>;
  editorRef?: Ref<MarkdownEditorHandle>;
  renderLink?: MarkdownLinkRenderer;
}

type PreviewDraft = Pick<MarkdownFieldsProps, 'value' | 'images' | 'renderLink'>;

export default function MarkdownFields({ id, label, previewLabel, value, onChange, placeholder, images, readOnly, onPaste, editorRef, renderLink }: MarkdownFieldsProps) {
  const [mode, setMode] = useState<'source' | 'preview'>('source');
  const [previewDraft, setPreviewDraft] = useState<PreviewDraft>();
  const [height, setHeight] = useState<number>();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const resizing = useRef<{ pointerId: number; y: number; height: number }>(undefined);
  const pending = useRef<MarkdownEdit>(undefined);
  const isPreview = mode === 'preview';
  const previewId = `${id}-preview`;
  const preview = isPreview ? { value, images, renderLink } : previewDraft;
  const { value: previewText, images: previewImages, renderLink: previewLink } = preview ?? {};
  const previewContent = useMemo(() => <MarkdownContent content={previewText || '开始输入后，这里会显示 Markdown 效果。'}
    images={previewImages} renderLink={previewLink} />, [previewText, previewImages, previewLink]);

  const switchMode = (next: typeof mode) => {
    if (next === mode) return;
    setPreviewDraft({ value, images, renderLink });
    setMode(next);
  };
  const resize = (next: number) => setHeight(Math.round(Math.max(200, Math.min(window.innerHeight * 0.85, next))));

  const applyEdit = useCallback((edit: MarkdownEdit) => {
    const field = textarea.current;
    if (!field || field.readOnly) return;
    field.focus({ preventScroll: true });
    const next = field.value.slice(0, edit.start) + edit.text + field.value.slice(edit.end);
    if (field.value !== next) {
      field.setSelectionRange(edit.start, edit.end);
      // Use the browser edit history when available so formatting can be undone with typing.
      try { field.ownerDocument.execCommand?.('insertText', false, edit.text); }
      catch { /* Fall back to applying plain text below. */ }
      if (field.value !== next) field.value = next;
      onChange(field.value);
    }
    field.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  }, [onChange]);

  useImperativeHandle(editorRef, () => ({
    insertAfterSelection(text, separatorWhenSelected = '') {
      const field = textarea.current;
      if (!field || readOnly) return false;
      const start = field.selectionEnd;
      const insertion = (field.selectionStart !== start ? separatorWhenSelected : '') + text;
      const caret = start + insertion.length;
      const edit = { start, end: start, text: insertion, selectionStart: caret, selectionEnd: caret };
      if (isPreview) {
        pending.current = edit;
        switchMode('source');
      } else applyEdit(edit);
      return true;
    },
  }));

  useLayoutEffect(() => {
    if (isPreview || !pending.current) return;
    const edit = pending.current;
    pending.current = undefined;
    applyEdit(edit);
  }, [isPreview, applyEdit]);

  const format = (command: MarkdownFormat, headingLevel?: HeadingLevel) => {
    const field = textarea.current;
    if (field && !isPreview) applyEdit(formatMarkdown(field.value, field.selectionStart, field.selectionEnd, command, headingLevel));
  };

  return (
    <div className="markdown-editor">
      <label className="markdown-editor-label" htmlFor={id}>{label}</label>
      <div className="markdown-editor-shell">
        <MarkdownToolbar sourceId={id} previewId={preview ? previewId : undefined} mode={mode} readOnly={readOnly}
          onModeChange={switchMode} onFormat={format} />
        <div ref={area} className="markdown-editor-area" data-mode={mode} style={{ height }}>
          <textarea ref={textarea} id={id} className="markdown-editor-view" inert={isPreview} value={value}
            onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} onPaste={onPaste} />
          {preview && <div id={previewId} className="markdown-preview markdown-editor-view" role="region" aria-label={previewLabel}
            tabIndex={0} inert={!isPreview}>
            {previewContent}
          </div>}
        </div>
        <div className="markdown-editor-footer">
          <button type="button" className="markdown-editor-resize" aria-label="调整编辑区高度" aria-controls={isPreview ? previewId : id}
            title="拖动或按 ↑ ↓ 调整高度，按 Enter 恢复默认" onPointerDown={(event) => {
              if (event.button !== 0 || !area.current || resizing.current) return;
              resizing.current = { pointerId: event.pointerId, y: event.clientY, height: area.current.offsetHeight };
              event.currentTarget.setPointerCapture(event.pointerId);
            }} onPointerMove={(event) => {
              const drag = resizing.current;
              if (drag?.pointerId === event.pointerId) resize(drag.height + event.clientY - drag.y);
            }} onLostPointerCapture={(event) => {
              if (resizing.current?.pointerId === event.pointerId) resizing.current = undefined;
            }} onKeyDown={(event) => {
              if (!area.current || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
              event.preventDefault();
              resize(area.current.offsetHeight + (event.key === 'ArrowDown' ? 24 : -24));
            }} onClick={(event) => { if (event.detail === 0) setHeight(undefined); }} onDoubleClick={() => setHeight(undefined)}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round">
              <path d="m3 13 10-10M8 13l5-5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
