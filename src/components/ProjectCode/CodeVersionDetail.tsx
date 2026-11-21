import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { practiceHref, readWorkspaceHash, useWorkspaceStore } from '../../store/workspaceStore';
import type { SearchLocation } from '../../store/workspaceStore';
import type { CodeProject, CodeVersion } from '../../types/projectCode';
import { CHAT_CODE_LIMIT } from '../../types/assistantChat';
import { makeCodeExcerpt, makeScriptReference, normalizeScriptLines } from '../../utils/assistantCode';
import { logLabel } from '../../utils/growth';
import { codeTargetKey, codeVersionSource, effectiveCodeLinks, parseCodePermalink } from '../../utils/projectCode';
import { matchScriptLine } from '../../utils/searchMatches';
import { codeCitationMarkdown, scriptMarkdown } from '../../utils/codeCitation';
import type { CodeLineRange } from '../../utils/codeCitation';
import { logCitesCode } from '../../utils/logCodeCitations';
import MarkdownContent from '../common/MarkdownContent';
import InlineReveal from '../common/InlineReveal';
import WorkspaceDialog from '../common/WorkspaceDialog';
import HighlightedText from '../common/HighlightedText';
import { useScrollToSearchMatch } from '../common/useScrollToSearchMatch';
import RelationLink from '../Relations/RelationLink';
import { AssistantSlots } from '../Assistant/assistantSlots';
import type { AssistantCodeExcerpt } from '../Assistant/assistantSlots';

function CodeReferences({ versionId }: { versionId: string }) {
  const data = useProjectCodeStore((state) => state.data);
  const logs = useStudyLogStore((state) => state.logs);
  const entries = useKnowledgeStore((state) => state.entries);
  const trashedEntries = useKnowledgeStore((state) => state.trash.entries);
  const outcomes = useGrowthStore((state) => state.outcomes);
  const trashedIds = new Set(trashedEntries.map(({ id }) => id));
  const references = effectiveCodeLinks(data, outcomes, entries).filter(({ versionId: linkedVersion, target }) =>
    linkedVersion === versionId && (target.kind !== 'entry' || !trashedIds.has(target.id)));
  const linkedLogs = new Set(references.flatMap(({ target }) => target.kind === 'log' ? [target.id] : []));
  const citedLogs = useMemo(() => logs.filter((log) => logCitesCode(log.content, versionId)), [logs, versionId]);
  const inlineOnly = citedLogs.filter(({ id }) => !linkedLogs.has(id));

  return (
    <section aria-label="引用记录">
      <h3>引用记录</h3>
      {references.length === 0 && inlineOnly.length === 0 && <p className="code-muted">可在日志、词条或实践中关联这份代码。</p>}
      <ul className="code-link-list">
        {inlineOnly.map((log) => <li key={'citation:' + log.id}><a href={'#history/' + log.date}>学习日志 · {logLabel(log)}</a></li>)}
        {references.map(({ target }) => {
          const key = codeTargetKey(target);
          if (target.kind === 'log') {
            const log = logs.find((item) => item.id === target.id);
            return <li key={key}>{log ? <a href={'#history/' + log.date}>学习日志 · {logLabel(log)}</a> : '学习日志已不可用'}</li>;
          }
          if (target.kind === 'entry') {
            const entry = entries.find((item) => item.id === target.id);
            return <li key={key}>{entry ? <a href={'#knowledge/' + encodeURIComponent(entry.id)}>知识词条 · {entry.title}</a> : '知识词条已不可用'}</li>;
          }
          const outcome = outcomes.find((item) => item.id === target.outcomeId);
          const practice = outcome?.practices.find((item) => item.id === target.id);
          return (
            <li key={key}>
              {outcome && practice
                ? <a href={practiceHref(outcome.id, practice.id)}>成长实践 · {outcome.title} · {practice.date}</a>
                : '成长实践已不可用'}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type CodeActionKind = 'shortcut' | 'selection' | 'line';

function ScriptPreview({ content, version, search, cited }: { content: string; version: CodeVersion; search: SearchLocation | null; cited?: CodeLineRange }) {
  const preview = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState<number>();
  const [action, setAction] = useState<{ x: number; y: number; excerpt?: AssistantCodeExcerpt; kind: CodeActionKind; keyboard: boolean; anchorLine?: string; anchorBox: DOMRect }>();
  const [selectionError, setSelectionError] = useState('');
  const [copied, setCopied] = useState(false);
  const { askAboutCode } = useContext(AssistantSlots);
  const normalized = useMemo(() => normalizeScriptLines(content), [content]);
  const markdown = useMemo(() => scriptMarkdown(normalized.replace(/\n$/, '')), [normalized]);
  const range = cited && cited.endLine <= normalized.replace(/\n$/, '').split('\n').length && content ? cited : undefined;
  useEffect(() => {
    if (!range) return;
    const frame = requestAnimationFrame(() => {
      preview.current?.querySelector('[data-code-cited="true"]')?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [range]);
  const match = search?.inSource ? matchScriptLine(content, search.words) : undefined;
  const captureSelection = useCallback(() => {
    const selection = window.getSelection();
    const script = preview.current?.querySelector('pre > code');
    const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
    if (!script || !range || range.collapsed || !script.contains(range.startContainer) || !script.contains(range.endContainer)) return;
    const before = document.createRange();
    before.selectNodeContents(script);
    before.setEnd(range.startContainer, range.startOffset);
    const prefix = before.toString();
    const start = prefix.length;
    const text = normalized.slice(start, start + range.toString().length).replace(/\n+$/, '');
    const startLine = prefix.split('\n').length;
    const excerpt = text.length > CHAT_CODE_LIMIT ? 'too-long' as const : makeCodeExcerpt(version, startLine, text, start);
    return { range, excerpt };
  }, [normalized, version]);
  useEffect(() => {
    if (!action) return;
    if (action.keyboard) popup.current?.querySelector('button')?.focus({ preventScroll: true });
    const dismiss = () => setAction(undefined);
    const scroll = () => {
      // Highlighting the active line can replace its element. Look up the line again.
      const line = preview.current?.querySelector(`[data-code-line="${action.anchorLine}"]`);
      const box = line?.getBoundingClientRect();
      if (!box || box.left !== action.anchorBox.left || box.top !== action.anchorBox.top) dismiss();
    };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !popup.current?.contains(event.target)) dismiss();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (action.keyboard || popup.current?.contains(document.activeElement)) {
        event.preventDefault();
        preview.current?.focus({ preventScroll: true });
      }
      dismiss();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('hashchange', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('hashchange', dismiss);
    };
  }, [action]);
  const ask = (excerpt?: AssistantCodeExcerpt) => {
    if (!excerpt) return;
    setAction(undefined);
    setSelectionError('');
    askAboutCode(excerpt);
  };
  const showAction = (anchor: HTMLElement, x: number, y: number, excerpt: AssistantCodeExcerpt | undefined, kind: CodeActionKind, keyboard = false) => {
    const height = kind === 'shortcut' ? 48 : 120;
    setAction({ x: Math.max(8, Math.min(x, window.innerWidth - 168)),
      y: Math.max(8, Math.min(y, window.innerHeight - height)), excerpt, kind, keyboard,
      anchorLine: anchor.dataset.codeLine, anchorBox: anchor.getBoundingClientRect() });
  };
  const showLineMenu = (line: HTMLElement, x: number, y: number, keyboard = false) => {
    const selected = captureSelection()?.excerpt;
    const number = Number(line.dataset.codeLine);
    setActiveLine(number);
    setSelectionError(selected === 'too-long' ? `请把选区缩小到 ${CHAT_CODE_LIMIT} 个字符以内。` : '');
    if (selected === 'too-long') {
      showAction(line, x, y, undefined, 'selection', keyboard);
    } else if (selected && number >= selected.startLine && number <= selected.endLine) {
      showAction(line, x, y, selected, 'selection', keyboard);
    } else {
      showAction(line, x, y, makeCodeExcerpt(version, number, line.textContent ?? ''), 'line', keyboard);
    }
  };
  const openMenu = (event: MouseEvent<HTMLDivElement>) => {
    const line = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-code-line]') : null;
    if (!line || !content.trim()) return;
    event.preventDefault();
    showLineMenu(line, event.clientX, event.clientY);
  };
  const openKeyboardMenu = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    const line = event.currentTarget.querySelector<HTMLElement>(activeLine ? `[data-code-line="${activeLine}"]` : '[data-code-line]');
    if (!line || !content.trim()) return;
    event.preventDefault();
    const { left, bottom } = event.currentTarget.getBoundingClientRect();
    showLineMenu(line, left + 8, Math.min(bottom, window.innerHeight) - 112, true);
  };
  const askScript = () => {
    setAction(undefined);
    setSelectionError('');
    askAboutCode(makeScriptReference(version));
  };
  const copyCitation = async (excerpt: CodeLineRange) => {
    setSelectionError('');
    setCopied(false);
    try {
      const name = version.path.split('/').at(-1) ?? version.path;
      await navigator.clipboard.writeText(codeCitationMarkdown(version.id, name + ` · L${excerpt.startLine}${excerpt.startLine === excerpt.endLine ? '' : '–' + excerpt.endLine}`, excerpt));
      setAction(undefined);
      setCopied(true);
      preview.current?.focus({ preventScroll: true });
    } catch { setSelectionError('无法复制，请在日志编辑器中选择该版本并填写行号。'); }
  };
  return (
    <section className="code-preview" aria-label="脚本快照">
      <div className="code-actions">
        <h3>脚本快照</h3>
        {content.trim() && <button type="button" className="knowledge-text-button" onClick={askScript}>询问脚本用途</button>}
      </div>
      {match && <p className="code-muted">命中第 {match.line} 行</p>}
      {cited && !range && <p className="code-muted">此行范围在该版本中不可用。</p>}
      {content ? <div ref={preview} className="markdown-preview script-preview" data-search-body tabIndex={0}
        aria-label="代码预览" role="group" onContextMenu={openMenu} onKeyDown={openKeyboardMenu}
        onPointerUp={(event) => {
          if (event.button !== 0) return;
          const line = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-code-line]') : null;
          window.requestAnimationFrame(() => {
            const captured = captureSelection();
            setSelectionError(captured?.excerpt === 'too-long' ? `请把选区缩小到 ${CHAT_CODE_LIMIT} 个字符以内。` : '');
            if (!captured) {
              if (line) setActiveLine(Number(line.dataset.codeLine));
              return;
            }
            const { range, excerpt } = captured;
            if (excerpt && excerpt !== 'too-long') {
              const anchor = preview.current?.querySelector<HTMLElement>(`[data-code-line="${excerpt.startLine}"]`);
              if (!anchor) return;
              const box = range.getBoundingClientRect();
              showAction(anchor, box.left, box.bottom + 6, excerpt, 'shortcut');
            }
          });
        }}><MarkdownContent content={markdown} searchWords={match ? search?.words : undefined} codeLines activeCodeLine={activeLine} highlightedCode={range} /></div> : <p>这份脚本为空文件。</p>}
      {selectionError && <p role="alert">{selectionError}</p>}
      {copied && <p role="status">已复制日志引用。</p>}
      {action && (action.kind === 'shortcut'
        ? <div ref={popup} className="script-ask-popover" style={{ left: action.x, top: action.y }}>
          <button type="button" className="note-button" onClick={() => ask(action.excerpt)}>询问智能体</button>
          {action.excerpt && <button type="button" className="note-button secondary" onClick={() => void copyCitation(action.excerpt!)}>复制日志引用</button>}
        </div>
        : <div ref={popup} className="workspace-context-menu script-ask-menu" role="group" aria-label="询问智能体"
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAction(undefined); }}
          style={{ left: action.x, top: action.y }}>
          <div className="workspace-context-menu-title" aria-hidden="true">询问智能体</div>
          {action.excerpt && <button type="button" onClick={() => ask(action.excerpt)}>
            {action.kind === 'selection' ? '询问所选代码' : '询问当前行'}
          </button>}
          <button type="button" onClick={askScript}>询问脚本用途</button>
          {action.excerpt && <button type="button" onClick={() => void copyCitation(action.excerpt!)}>复制日志引用</button>}
        </div>)}
    </section>
  );
}

export default function CodeVersionDetail({ version, project }: { version: CodeVersion; project: CodeProject }) {
  const { saveVersionDetails, trashVersion } = useProjectCodeStore();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNote] = useState(version.note);
  const [githubUrl, setGithubUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const editTrigger = useRef<HTMLButtonElement>(null);
  const detail = useRef<HTMLElement>(null);
  const search = useWorkspaceStore((state) => state.search?.page === 'code' && state.search.id === version.id ? state.search : null);
  const cited = useWorkspaceStore((state) => state.codeCitationRange);
  useScrollToSearchMatch(detail, search);
  const commit = version.githubUrl ? parseCodePermalink(version.githubUrl).commit : '';

  const closeEditor = (message = '') => {
    setEditing(false);
    setMessage(message);
  };

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      await saveVersionDetails(version.id, note, githubUrl);
      closeEditor('版本资料已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await trashVersion(version.id);
    const { page, id } = readWorkspaceHash();
    if (page === 'code' && id === version.id) window.location.hash = 'code';
  };

  return (
    <article ref={detail} className="module-card code-version">
      <p className="code-muted"><HighlightedText text={project.name} words={search?.words} /></p>
      <h2><HighlightedText text={version.path} words={search?.words} /></h2>
      <p className="code-muted">{codeVersionSource(version)} · 保存于 {new Date(version.savedAt).toLocaleString('zh-CN')}</p>
      {version.note && <p className="code-note"><HighlightedText text={version.note} words={search?.words} /></p>}
      {version.githubUrl && (
        <p>
          <a href={version.githubUrl} target="_blank" rel="noreferrer">在 GitHub 查看此版本</a> <code>{commit.slice(0, 10)}</code>
        </p>
      )}
      <div className="code-actions detail-actions">
        <button ref={editTrigger} type="button" className="note-button secondary" aria-expanded={editing} disabled={busy || editing} onClick={() => {
          setNote(version.note);
          setGithubUrl('');
          setMessage('');
          setEditing(true);
        }}>编辑版本资料</button>
        <RelationLink kind="code" id={version.id} />
        <button type="button" className="knowledge-text-button danger" disabled={busy || editing} onClick={() => setConfirmDelete(true)}>删除代码版本</button>
      </div>
      <InlineReveal open={editing} trigger={editTrigger}>
        <form className="code-form" aria-label="编辑代码版本资料" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={busy}>
            <legend>编辑版本资料</legend>
            <label>版本说明（可选）
              <textarea rows={3} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
            </label>
            {!version.githubUrl && <>
              <label>GitHub 固定链接
                <input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="填写这份快照对应的提交链接" />
              </label>
              <p className="code-muted">确认提交中的脚本与这份快照对应后，再补上来源。</p>
            </>}
            {message && editing && <p role="alert">{message}</p>}
            <button type="submit" className="note-button">{busy ? '保存中…' : '保存版本资料'}</button>
            <button type="button" className="note-button secondary" onClick={() => closeEditor()}>取消</button>
          </fieldset>
        </form>
      </InlineReveal>
      {message && !editing && <p role="status">{message}</p>}
      {version.content === null
        ? <p className="code-muted">此版本仅保存链接。私有文件可用有权限的 GitHub 账号打开。</p>
        : <ScriptPreview content={version.content} version={version} search={search} cited={cited} />}
      <CodeReferences versionId={version.id} />
      {confirmDelete && <WorkspaceDialog title="删除代码版本" action="移入回收站" destructive onClose={() => setConfirmDelete(false)} onSave={remove}>
        <p>将「{version.path}」的这个版本移入回收站？可在「数据管理」的「代码」分类恢复。</p>
      </WorkspaceDialog>}
    </article>
  );
}
