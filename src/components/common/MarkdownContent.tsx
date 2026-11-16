import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';
import { getImage, IMAGE_PREFIX } from '../../utils/imageStorage';
import type { StoredImage } from '../../utils/imageStorage';
import { rehypeSearchMatches } from '../../utils/rehypeSearchMatches';
import { rehypeCodeLines } from '../../utils/rehypeCodeLines';
import NoteImage from './NoteImage';

const MarkdownOptions = createContext<{ images?: StoredImage[]; activeCodeLine?: number; onExpandImage?: () => void }>({});
const InsideMarkdownLink = createContext(false);

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const { images, onExpandImage } = useContext(MarkdownOptions);
  const hasLink = useContext(InsideMarkdownLink);
  const id = src?.startsWith(IMAGE_PREFIX) ? src.slice(IMAGE_PREFIX.length) : undefined;
  const image = id ? images?.find((entry) => entry.id === id) : undefined;
  const [resolved, setResolved] = useState<{ source: string; url?: string; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!src?.startsWith(IMAGE_PREFIX)) return;
    let active = true;
    let objectUrl: string | undefined;
    (image ? Promise.resolve(image) : getImage(src.slice(IMAGE_PREFIX.length))).then((image) => {
      if (!active) return;
      if (image) {
        objectUrl = URL.createObjectURL(image.blob);
        setResolved({ source: src, url: objectUrl });
      } else setResolved({ source: src, failed: true });
    }).catch(() => { if (active) setResolved({ source: src, failed: true }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, image]);
  const url = src?.startsWith(IMAGE_PREFIX) ? resolved?.source === src ? resolved.url : undefined : src;
  if (!url) return <span className="markdown-image-message">{resolved && resolved.source === src && resolved.failed ? `图片未找到：${alt ?? ''}` : `正在载入图片：${alt ?? ''}`}</span>;
  if (hasLink) return <img src={url} alt={alt ?? ''} loading="lazy" />;
  if (onExpandImage) return <NoteImage key={url} url={url} alt={alt ?? ''} onExpand={onExpandImage} />;
  return <a href={url} target="_blank" rel="noreferrer" title="在新标签页查看原图"><img src={url} alt={alt ?? ''} loading="lazy" /></a>;
}

// Keep renderer types stable when the note remeasures loaded images or changes its preview state.
const markdownComponents: Components = {
  img: MarkdownImage,
  span: function MarkdownSpan({ node, ...props }) {
    const { activeCodeLine } = useContext(MarkdownOptions);
    return <span {...props} aria-current={node?.properties.dataCodeLine === activeCodeLine && activeCodeLine !== undefined ? 'true' : undefined} />;
  },
  a: ({ href, children }) => href && /^https?:\/\//i.test(href)
    ? <a href={href} target="_blank" rel="noreferrer"><InsideMarkdownLink.Provider value>{children}</InsideMarkdownLink.Provider></a>
    : href?.startsWith('#') ? <a href={href}><InsideMarkdownLink.Provider value>{children}</InsideMarkdownLink.Provider></a>
    : <span title={`本地来源 ${href ?? ''}，请在原资料目录查看`}>{children} <small>（本地资料）</small></span>,
};

export default function MarkdownContent({ content, images, searchWords, codeLines, activeCodeLine, onExpandImage }: {
  content: string; images?: StoredImage[]; searchWords?: string[]; codeLines?: boolean; activeCodeLine?: number; onExpandImage?: () => void;
}) {
  const options = useMemo(() => ({ images, activeCodeLine, onExpandImage }), [images, activeCodeLine, onExpandImage]);
  const plugins: PluggableList = [[rehypeHighlight, { ignoreMissing: true }]];
  if (searchWords?.length) plugins.push([rehypeSearchMatches, searchWords]);
  if (codeLines) plugins.push(rehypeCodeLines);
  return (
    <MarkdownOptions.Provider value={options}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={plugins}
        urlTransform={(url, key) => key === 'src' && url.startsWith(IMAGE_PREFIX) ? url : defaultUrlTransform(url)}
        components={markdownComponents}
      >{content}</ReactMarkdown>
    </MarkdownOptions.Provider>
  );
}
