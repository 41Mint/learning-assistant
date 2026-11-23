import { useCallback, useDeferredValue, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEventHandler, Ref } from 'react';
import type { StoredImage } from '../../utils/imageStorage';
import { formatMarkdown, insertMarkdownBlock } from '../../utils/markdownEditing';
import type { HeadingLevel, MarkdownEdit, MarkdownFormat } from '../../utils/markdownEditing';
import MarkdownContent from './MarkdownContent';
import type { MarkdownLinkRenderer } from './MarkdownContent';
import MarkdownInsertOptions from './MarkdownInsertOptions';
import MarkdownToolbar from './MarkdownToolbar';
import { highlightMarkdownSource } from './MarkdownSourceHighlight';

export interface MarkdownEditorHandle {
  insertAfterSelection: (text: string, separatorWhenSelected?: string) => boolean;
}

export interface MarkdownInsertOptionsProps {
  selectedText: string;
  insert: (text: string, afterSelectionSeparator?: string) => void;
  insertBlock: (text: string, options?: { selection?: [number, number]; images?: StoredImage[] }) => void;
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
  onInsertImages: (images: StoredImage[]) => void;
}

type PreviewDraft = Pick<MarkdownFieldsProps, 'value' | 'images' | 'renderLink'>;
interface Insertion {
  start: number;
  end: number;
  direction: HTMLTextAreaElement['selectionDirection'];
  value: string;
  source: HTMLElement;
  point?: { x: number; y: number };
}

export default function MarkdownFields({ id, label, previewLabel, value, onChange, placeholder, images, readOnly, onPaste, editorRef, renderLink, onInsertImages }: MarkdownFieldsProps) {
  const [mode, setMode] = useState<'source' | 'preview'>('source');
  const [previewDraft, setPreviewDraft] = useState<PreviewDraft>();
  const [height, setHeight] = useState<number>();
  const [composing, setComposing] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const sourceMirror = useRef<HTMLPreElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const resizing = useRef<{ pointerId: number; y: number; height: number }>(undefined);
  const pending = useRef<MarkdownEdit>(undefined);
  const panel = useRef<HTMLDivElement>(null);
  const [insertion, setInsertion] = useState<Insertion>();
  const isPreview = mode === 'preview';
  const deferredSource = useDeferredValue(isPreview || composing ? '' : value);
  const highlightedSource = useMemo(() => highlightMarkdownSource(deferredSource), [deferredSource]);
  const showSourceHighlight = !isPreview && !composing && deferredSource === value && highlightedSource !== null;
  const insertId = `${id}-insert`;
  const previewId = `${id}-preview`;
  const preview = isPreview ? { value, images, renderLink } : previewDraft;
  const { value: previewText, images: previewImages, renderLink: previewLink } = preview ?? {};
  const previewContent = useMemo(() => <MarkdownContent content={previewText || '开始输入后，这里会显示 Markdown 效果。'}
    images={previewImages} renderLink={previewLink} />, [previewText, previewImages, previewLink]);

  const switchMode = (next: typeof mode) => {
    if (next === mode) return;
    setInsertion(undefined);
    setPreviewDraft({ value, images, renderLink });
    setMode(next);
  };
  const resize = (next: number) => setHeight(Math.round(Math.max(200, Math.min(window.innerHeight * 0.85, next))));

  const syncSourceScroll = useCallback(() => {
    const field = textarea.current;
    const mirror = sourceMirror.current;
    if (!field || !mirror) return;
    mirror.style.width = `${field.clientWidth}px`;
    mirror.style.height = `${field.clientHeight}px`;
    mirror.scrollTop = field.scrollTop;
    mirror.scrollLeft = field.scrollLeft;
  }, []);

  useLayoutEffect(() => {
    const field = textarea.current;
    if (!field) return;
    const observer = new ResizeObserver(syncSourceScroll);
    observer.observe(field);
    return () => observer.disconnect();
  }, [syncSourceScroll]);

  useLayoutEffect(syncSourceScroll, [showSourceHighlight, highlightedSource, syncSourceScroll]);

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

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    if (!insertion || readOnly) {
      element.hidePopover();
      return;
    }
    const position = () => {
      const rect = insertion.source.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;
      const left = insertion.point?.x ?? rect.left;
      const below = Math.max(8, Math.min(innerHeight - 8, (insertion.point?.y ?? rect.bottom) + 6));
      const above = Math.max(8, Math.min(innerHeight - 8, (insertion.point?.y ?? rect.top) - 6));
      const opensAbove = innerHeight - below < 280 && above > innerHeight - below;
      element.style.left = `${Math.max(8, Math.min(left, innerWidth - element.offsetWidth - 8))}px`;
      element.style.top = opensAbove ? 'auto' : `${below}px`;
      element.style.bottom = opensAbove ? `${innerHeight - above}px` : 'auto';
      element.style.maxHeight = `${(opensAbove ? above : innerHeight - below) - 8}px`;
    };
    element.showPopover({ source: insertion.source });
    position();
    element.querySelector('button')?.focus({ preventScroll: true });
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [insertion, readOnly]);

  const openInsertion = (source: HTMLElement, point?: Insertion['point']) => {
    const field = textarea.current;
    if (!field || field.readOnly || isPreview) return;
    setInsertion({ start: field.selectionStart, end: field.selectionEnd, direction: field.selectionDirection, value: field.value, source, point });
  };

  const closeInsertion = () => {
    panel.current?.hidePopover();
    setInsertion(undefined);
  };

  const commitInsertion = (edit: MarkdownEdit) => {
    const field = textarea.current;
    if (!insertion || !field || field.readOnly || field.inert || field.value !== insertion.value || !panel.current?.matches(':popover-open')) return false;
    closeInsertion();
    applyEdit(edit);
    return true;
  };

  const insert: MarkdownInsertOptionsProps['insert'] = (text, afterSelectionSeparator) => {
    if (!insertion) return;
    const { start, end } = insertion;
    const afterSelection = afterSelectionSeparator !== undefined;
    const editStart = afterSelection ? end : start;
    const replacement = (afterSelection && start !== end ? afterSelectionSeparator : '') + text;
    const caret = editStart + replacement.length;
    commitInsertion({ start: editStart, end, text: replacement, selectionStart: caret, selectionEnd: caret });
  };

  const insertBlock: MarkdownInsertOptionsProps['insertBlock'] = (text, options) => {
    if (!insertion) return;
    const edit = insertMarkdownBlock(insertion.value, insertion.end, insertion.end, text, options?.selection);
    if (commitInsertion(edit) && options?.images?.length) onInsertImages(options.images);
  };

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
          onModeChange={switchMode} onFormat={format} sourceTools={(
            <button type="button" className="markdown-format-button" aria-label="插入" title="插入"
              aria-controls={insertId} aria-expanded={Boolean(insertion) && !readOnly} disabled={isPreview || readOnly}
              onClick={(event) => { if (insertion) closeInsertion(); else openInsertion(event.currentTarget); }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 8h10M8 3v10" />
              </svg>
            </button>
          )} />
        <div ref={panel} id={insertId} popover="auto" className="workspace-context-menu markdown-insert-panel"
          role="group" aria-label="插入到 Markdown" onToggle={(event) => {
            if (!event.currentTarget.matches(':popover-open')) setInsertion(undefined);
          }} onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'file') event.preventDefault();
            if (event.key !== 'Escape' || !insertion) return;
            event.preventDefault();
            event.stopPropagation();
            closeInsertion();
            const field = textarea.current;
            field?.focus({ preventScroll: true });
            field?.setSelectionRange(insertion.start, insertion.end, insertion.direction);
          }}>
          {insertion && <MarkdownInsertOptions selectedText={insertion.value.slice(insertion.start, insertion.end)} insert={insert} insertBlock={insertBlock} />}
        </div>
        <div ref={area} className="markdown-editor-area" data-mode={mode} data-source-highlight={showSourceHighlight || undefined} style={{ height }}>
          <pre ref={sourceMirror} className="markdown-source-highlight" aria-hidden="true">
            {highlightedSource}{deferredSource.endsWith('\n') ? '\u200b' : null}
          </pre>
          <textarea ref={textarea} id={id} className="markdown-editor-view" inert={isPreview} value={value}
            onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} onPaste={onPaste}
            onScroll={syncSourceScroll} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
            onContextMenu={(event) => {
              if (event.shiftKey || readOnly) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              openInsertion(event.currentTarget, event.clientX || event.clientY
                ? { x: event.clientX, y: event.clientY } : { x: rect.left, y: rect.top });
            }} />
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
