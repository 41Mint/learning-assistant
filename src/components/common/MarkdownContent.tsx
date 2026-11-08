import { useEffect, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';
import { getImage, IMAGE_PREFIX } from '../../utils/imageStorage';
import type { StoredImage } from '../../utils/imageStorage';
import { rehypeSearchMatches } from '../../utils/rehypeSearchMatches';

function MarkdownImage({ src, alt, image }: { src?: string; alt?: string; image?: StoredImage }) {
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
  return <a href={url} target="_blank" rel="noreferrer" title="在新标签页查看原图"><img src={url} alt={alt ?? ''} loading="lazy" /></a>;
}

export default function MarkdownContent({ content, images, searchWords }: { content: string; images?: StoredImage[]; searchWords?: string[] }) {
  const plugins: PluggableList = [[rehypeHighlight, { ignoreMissing: true }]];
  if (searchWords?.length) plugins.push([rehypeSearchMatches, searchWords]);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={plugins}
      urlTransform={(url, key) => key === 'src' && url.startsWith(IMAGE_PREFIX) ? url : defaultUrlTransform(url)}
      components={{
        img: ({ src, alt }) => <MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} image={typeof src === 'string' ? images?.find((image) => `${IMAGE_PREFIX}${image.id}` === src) : undefined} />,
        a: ({ href, children }) => href && /^https?:\/\//i.test(href)
          ? <a href={href} target="_blank" rel="noreferrer">{children}</a>
          : href?.startsWith('#') ? <a href={href}>{children}</a>
          : <span title={`本地来源 ${href ?? ''}，请在原资料目录查看`}>{children} <small>（本地资料）</small></span>,
      }}
    >{content}</ReactMarkdown>
  );
}
