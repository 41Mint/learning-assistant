import { useMemo, useRef, useState } from 'react';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { practiceHref, readWorkspaceHash, useWorkspaceStore } from '../../store/workspaceStore';
import type { SearchLocation } from '../../store/workspaceStore';
import type { CodeProject, CodeVersion } from '../../types/projectCode';
import { logLabel } from '../../utils/growth';
import { codeTargetKey, codeVersionSource, effectiveCodeLinks, parseCodePermalink } from '../../utils/projectCode';
import { matchScriptLine } from '../../utils/searchMatches';
import MarkdownContent from '../common/MarkdownContent';
import FocusEditor from '../common/FocusEditor';
import HighlightedText from '../common/HighlightedText';
import { useScrollToSearchMatch } from '../common/useScrollToSearchMatch';

function CodeReferences({ versionId }: { versionId: string }) {
  const data = useProjectCodeStore((state) => state.data);
  const logs = useStudyLogStore((state) => state.logs);
  const entries = useKnowledgeStore((state) => state.entries);
  const outcomes = useGrowthStore((state) => state.outcomes);
  const references = effectiveCodeLinks(data, outcomes, entries).filter((link) => link.versionId === versionId);

  return (
    <section aria-label="引用记录">
      <h3>引用记录</h3>
      {references.length === 0 && <p className="code-muted">可在日志、词条或实践中关联这份代码。</p>}
      <ul className="code-link-list">
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

function ScriptPreview({ content, search }: { content: string; search: SearchLocation | null }) {
  const markdown = useMemo(() => {
    // 选择比脚本里任何可能闭合代码块的围栏更长的围栏。
    let length = 3;
    for (const match of content.matchAll(/^ {0,3}(~{3,})/gm)) length = Math.max(length, match[1].length + 1);
    const fence = '~'.repeat(length);
    return fence + 'csharp\n' + content + '\n' + fence;
  }, [content]);
  const match = search?.inSource ? matchScriptLine(content, search.words) : undefined;
  return (
    <section className="code-preview" aria-label="脚本快照">
      <h3>脚本快照</h3>
      {match && <p className="code-muted">命中第 {match.line} 行</p>}
      {content ? <div className="markdown-preview" data-search-body><MarkdownContent content={markdown} searchWords={match ? search?.words : undefined} /></div> : <p>这份脚本为空文件。</p>}
    </section>
  );
}

export default function CodeVersionDetail({ version, project }: { version: CodeVersion; project: CodeProject }) {
  const { saveVersionDetails, deleteVersion } = useProjectCodeStore();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(version.note);
  const [githubUrl, setGithubUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const editTrigger = useRef<HTMLButtonElement>(null);
  const detail = useRef<HTMLElement>(null);
  const search = useWorkspaceStore((state) => state.search?.page === 'code' && state.search.id === version.id ? state.search : null);
  useScrollToSearchMatch(detail, search);
  const commit = version.githubUrl ? parseCodePermalink(version.githubUrl).commit : '';

  const closeEditor = (message = '') => {
    setEditing(false);
    setMessage(message);
    window.requestAnimationFrame(() => editTrigger.current?.focus());
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
    if (!window.confirm('确定删除这个代码版本及其关联？')) return;
    setBusy(true);
    try {
      await deleteVersion(version.id);
      const { page, id } = readWorkspaceHash();
      if (page === 'code' && id === version.id) window.location.hash = 'code';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <article className="module-card code-version code-focus-card">
        <FocusEditor title="编辑版本资料" description={project.name + ' · ' + version.path}
          formLabel="编辑代码版本资料" saveLabel="保存版本资料" busy={busy} error={message}
          onSave={() => void save()} onCancel={() => closeEditor()}>
          <div className="code-form">
            <label>版本说明（可选）
              <textarea rows={3} value={note} maxLength={1000} disabled={busy} onChange={(event) => setNote(event.target.value)} />
            </label>
            {!version.githubUrl && (
              <>
                <label>GitHub 固定链接
                  <input type="url" value={githubUrl} disabled={busy} onChange={(event) => setGithubUrl(event.target.value)}
                    placeholder="填写这份快照对应的提交链接" />
                </label>
                <p className="code-muted">确认提交中的脚本与这份快照对应后，再补上来源。</p>
              </>
            )}
          </div>
        </FocusEditor>
      </article>
    );
  }

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
      <div className="code-actions">
        <button ref={editTrigger} type="button" className="note-button secondary" disabled={busy} onClick={() => {
          setNote(version.note);
          setGithubUrl('');
          setMessage('');
          setEditing(true);
        }}>编辑版本资料</button>
        <button type="button" className="knowledge-text-button danger" disabled={busy} onClick={() => void remove()}>删除代码版本</button>
      </div>
      {message && <p role="status">{message}</p>}
      {version.content === null
        ? <p className="code-muted">此版本仅保存链接。私有文件可用有权限的 GitHub 账号打开。</p>
        : <ScriptPreview content={version.content} search={search} />}
      <CodeReferences versionId={version.id} />
    </article>
  );
}
