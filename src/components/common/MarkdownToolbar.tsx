import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { HeadingLevel, MarkdownFormat } from '../../utils/markdownEditing';
import SegmentedControl from './SegmentedControl';

const formatGroups = [
  [['bold', '加粗', 'B'], ['italic', '斜体', 'I'], ['code', '行内代码', '</>'], ['link', '链接', null]],
  [['quote', '引用', '❞'], ['bullet', '无序列表', '•≡'], ['numbered', '有序列表', '1≡'], ['task', '任务列表', '☑'], ['codeBlock', '代码块', '代码块']],
] as const;

const headings = [[1, '一级标题'], [2, '二级标题'], [3, '三级标题'], [4, '四级标题'], [5, '五级标题'], [6, '六级标题']] as const;
const additionalHeadings = headings.filter(([level]) => level !== 2);

interface MarkdownToolbarProps {
  sourceId: string;
  previewId?: string;
  mode: 'source' | 'preview';
  readOnly?: boolean;
  onModeChange: (mode: 'source' | 'preview') => void;
  onFormat: (command: MarkdownFormat, headingLevel?: HeadingLevel) => void;
}

export default function MarkdownToolbar({ sourceId, previewId, mode, readOnly, onModeChange, onFormat }: MarkdownToolbarProps) {
  const [hasRoom, setHasRoom] = useState(false);
  const [openedBy, setOpenedBy] = useState<'automatic' | 'press'>();
  const slot = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const stripChoices = useRef<HTMLDivElement>(null);
  const compactH2 = useRef<HTMLButtonElement>(null);
  const restoreTrigger = useRef(false);
  const disabled = mode === 'preview' || Boolean(readOnly);
  if (disabled && openedBy) setOpenedBy(undefined);
  const wideOpen = !disabled && hasRoom && Boolean(openedBy);
  const compactOpen = !disabled && !hasRoom && openedBy === 'press';
  const expanded = wideOpen || compactOpen;
  const headingId = `${sourceId}-heading-levels`;
  const compactId = `${headingId}-compact`;

  useLayoutEffect(() => {
    const area = slot.current;
    const button = trigger.current;
    const choices = stripChoices.current;
    if (!area || !button || !choices) return;
    let previousFit = false;
    const measure = () => {
      const fits = area.clientWidth > 0 && area.clientWidth >= button.offsetWidth + choices.offsetWidth;
      if (fits !== previousFit && picker.current?.contains(document.activeElement)) restoreTrigger.current = true;
      previousFit = fits;
      setHasRoom(fits);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(button);
    observer.observe(choices);
    measure();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (compactOpen) {
      restoreTrigger.current = false;
      compactH2.current?.focus({ preventScroll: true });
    } else if (restoreTrigger.current) {
      restoreTrigger.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
  }, [compactOpen, hasRoom]);

  useEffect(() => {
    if (!expanded) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setOpenedBy(undefined);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [expanded]);

  const closeAndFocus = () => {
    if (compactOpen) restoreTrigger.current = true;
    else trigger.current?.focus({ preventScroll: true });
    setOpenedBy(undefined);
  };
  const chooseHeading = (level: HeadingLevel) => {
    setOpenedBy(undefined);
    onFormat('heading', level);
  };
  const headingButtons = (levels: readonly (readonly [HeadingLevel, string])[]) => levels.map(([level, label]) => (
    <button key={level} ref={level === 2 ? compactH2 : undefined} type="button" className="markdown-format-button"
      aria-label={label} title={label} disabled={disabled} onMouseDown={(event) => event.preventDefault()}
      onClick={() => chooseHeading(level)}>H{level}</button>
  ));

  return <div className="markdown-editor-bar">
    <div className="markdown-formatting" role="group" aria-label="Markdown 格式" data-choosing-heading={compactOpen || undefined}>
      {formatGroups.map((tools) => <div className="markdown-format-group" key={tools[0][0]} inert={compactOpen}>
        {tools.map(([command, name, symbol]) => <button key={command} type="button" className="markdown-format-button"
          data-format={command} aria-label={name} title={name} disabled={disabled}
          onMouseDown={(event) => event.preventDefault()} onClick={() => onFormat(command)}>{symbol ?? (
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M10 13.5a4 4 0 0 0 5.7 0l3.4-3.4a4 4 0 0 0-5.7-5.7l-1.7 1.7m2.3 4.4a4 4 0 0 0-5.7 0l-3.4 3.4a4 4 0 0 0 5.7 5.7l1.7-1.7" />
            </svg>
          )}</button>)}
      </div>)}
      <div className="markdown-heading-slot" ref={slot}>
        <div className="markdown-heading-picker" ref={picker} data-compact={compactOpen || undefined}
          onPointerEnter={(event) => {
            if (hasRoom && !disabled && event.pointerType === 'mouse') setOpenedBy((current) => current ?? 'automatic');
          }} onPointerLeave={(event) => {
            if (event.pointerType !== 'mouse' || event.currentTarget.contains(document.activeElement)) return;
            setOpenedBy((current) => current === 'press' ? current : undefined);
          }} onBlur={(event) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpenedBy(undefined);
          }} onKeyDown={(event) => {
            if (event.key !== 'Escape' || !expanded) return;
            event.preventDefault();
            event.stopPropagation();
            closeAndFocus();
          }}>
          <button type="button" ref={trigger} className="markdown-format-button markdown-heading-trigger" inert={compactOpen}
            aria-label={hasRoom ? '二级标题' : '选择标题级别'} title={hasRoom ? '二级标题，悬停可选其他级别' : '选择标题级别'}
            aria-expanded={expanded} aria-controls={hasRoom ? headingId : compactOpen ? compactId : undefined} disabled={disabled}
            onFocus={(event) => {
              if (hasRoom && event.currentTarget.matches(':focus-visible') && !picker.current?.contains(event.relatedTarget)) {
                setOpenedBy((current) => current ?? 'automatic');
              }
            }}
            onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
              const pointer = event.nativeEvent;
              const touch = pointer instanceof PointerEvent && (pointer.pointerType === 'touch' || pointer.pointerType === 'pen');
              if (!hasRoom || (touch && openedBy !== 'press')) setOpenedBy('press');
              else chooseHeading(2);
            }}>
            H2 <svg aria-hidden="true" width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 2 4 4-4 4" /></svg>
          </button>
          <div className="markdown-heading-strip" id={headingId} role="group" aria-label="标题级别"
            data-fits={hasRoom || undefined} data-open={wideOpen || undefined} inert={!wideOpen}>
            <div className="markdown-heading-choices" ref={stripChoices}>{headingButtons(additionalHeadings)}</div>
          </div>
          {compactOpen && <div className="markdown-heading-choices markdown-heading-compact" id={compactId} role="group" aria-label="标题级别">
            <div className="markdown-heading-choices">
              <button type="button" className="markdown-format-button" aria-label="返回格式工具" title="返回格式工具" onClick={closeAndFocus}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m8 4-4 4 4 4m-4-4h8" /></svg>
              </button>
              {headingButtons(headings.slice(0, 3))}
            </div>
            <div className="markdown-heading-choices">{headingButtons(headings.slice(3))}</div>
          </div>}
        </div>
      </div>
    </div>
    <SegmentedControl className="markdown-editor-modes" label="Markdown 视图">
      <button type="button" aria-pressed={mode === 'source'} aria-controls={sourceId} onClick={() => onModeChange('source')}>源码</button>
      <button type="button" aria-pressed={mode === 'preview'} aria-controls={previewId} onClick={() => onModeChange('preview')}>预览</button>
    </SegmentedControl>
  </div>;
}
