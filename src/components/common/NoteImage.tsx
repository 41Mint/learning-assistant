import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function ImageDetail({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dimensions, setDimensions] = useState('');
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    window.addEventListener('hashchange', onClose);
    return () => window.removeEventListener('hashchange', onClose);
  }, [onClose]);

  return createPortal(<dialog ref={dialog} className="note-image-viewer" aria-label="图片详情"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="note-image-viewer-content">
      <header>
        <div>
          <h2>{alt || '图片详情'}</h2>
          {dimensions && <p>{dimensions}</p>}
        </div>
        <a className="workspace-button" href={url} target="_blank" rel="noreferrer">在新标签页打开原图</a>
        <button autoFocus type="button" className="workspace-icon-button" aria-label="关闭图片详情" onClick={onClose}>×</button>
      </header>
      <img src={url} alt={alt} onLoad={({ currentTarget: image }) => setDimensions(`${image.naturalWidth} × ${image.naturalHeight} 像素`)} />
    </div>
  </dialog>, document.body);
}

export default function NoteImage({ url, alt, onExpand }: { url: string; alt: string; onExpand: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const clickTimer = useRef<number | undefined>(undefined);
  const previousSize = useRef(false);
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);

  const toggleSize = () => {
    if (!expanded) onExpand();
    setExpanded(!expanded);
  };

  return <span className="note-image" data-expanded={expanded || undefined}>
    <button type="button" className="note-image-toggle" aria-pressed={expanded}
      aria-label={alt ? `切换图片尺寸 · ${alt}` : '切换图片尺寸'}
      title={expanded ? '单击缩小，双击查看图片详情' : '单击放大，双击查看图片详情'}
      onClick={(event) => {
        if (!event.detail) {
          toggleSize();
          return;
        }
        if (event.detail === 1) {
          window.clearTimeout(clickTimer.current);
          previousSize.current = expanded;
          clickTimer.current = window.setTimeout(toggleSize, 420);
        }
      }}
      onDoubleClick={() => {
        window.clearTimeout(clickTimer.current);
        setExpanded(previousSize.current);
        setDetailOpen(true);
      }}>
      <img src={url} alt={alt} loading="lazy" />
    </button>
    <button type="button" className="knowledge-text-button note-image-details"
      aria-label={alt ? `查看原图 · ${alt}` : '查看原图'} onClick={() => setDetailOpen(true)}>查看原图</button>
    {detailOpen && <ImageDetail url={url} alt={alt} onClose={() => setDetailOpen(false)} />}
  </span>;
}
