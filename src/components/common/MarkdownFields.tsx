import type { ClipboardEventHandler, RefObject } from 'react';
import type { StoredImage } from '../../utils/imageStorage';
import MarkdownContent from './MarkdownContent';
import type { MarkdownLinkRenderer } from './MarkdownContent';

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
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  renderLink?: MarkdownLinkRenderer;
}

export default function MarkdownFields({ id, label, previewLabel, value, onChange, placeholder, images, readOnly, onPaste, textareaRef, renderLink }: MarkdownFieldsProps) {
  return (
    <div className="editor-grid">
      <div className="editor-pane">
        <label className="editor-pane-label" htmlFor={id}>{label}</label>
        <textarea ref={textareaRef} id={id} className="editor-pane-area" value={value} onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder} readOnly={readOnly} onPaste={onPaste} />
      </div>
      <div className="editor-pane">
        <p className="editor-pane-label">实时预览</p>
        <div className="markdown-preview editor-pane-area" role="region" aria-label={previewLabel} tabIndex={0}>
          <MarkdownContent content={value || '开始输入后，这里会显示 Markdown 效果。'} images={images} renderLink={renderLink} />
        </div>
      </div>
    </div>
  );
}
