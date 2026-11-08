import MarkdownContent from './MarkdownContent';

interface MarkdownFieldsProps {
  id: string;
  label: string;
  previewLabel: string;
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function MarkdownFields({ id, label, previewLabel, value, onChange, placeholder }: MarkdownFieldsProps) {
  return (
    <div className="editor-grid">
      <div className="editor-pane">
        <label className="editor-pane-label" htmlFor={id}>{label}</label>
        <textarea id={id} className="editor-pane-area" value={value} onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder} />
      </div>
      <div className="editor-pane">
        <p className="editor-pane-label">实时预览</p>
        <div className="markdown-preview editor-pane-area" role="region" aria-label={previewLabel} tabIndex={0}>
          <MarkdownContent content={value || '开始输入后，这里会显示 Markdown 效果。'} />
        </div>
      </div>
    </div>
  );
}
