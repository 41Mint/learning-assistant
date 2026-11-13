import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import type { CodeVersion, ProjectDirectory } from '../../types/projectCode';
import { codeVersionHref, codeVersionSource } from '../../utils/projectCode';
import { projectDirectoryPaths } from '../../utils/projectDirectory';
import ProjectDirectoryTree from './ProjectDirectoryTree';

function DirectoryItem({ projectId, path, note, versions, isFile }: {
  projectId: string;
  path: string;
  note: string;
  versions: CodeVersion[];
  isFile: boolean;
}) {
  const saveDirectoryNote = useProjectCodeStore((state) => state.saveDirectoryNote);
  const [text, setText] = useState(note);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean }>();
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await saveDirectoryNote(projectId, path, text);
      setText(text.trim());
      setStatus({ text: '职责说明已保存。' });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : '职责说明保存失败。', error: true });
    } finally { setBusy(false); }
  };
  return <div className="project-directory-item">
    <h4>{path}</h4>
    {isFile && /\.cs$/i.test(path) && (versions.length ? <ul className="code-link-list" aria-label="此路径的代码版本">
      {versions.map((version) => <li key={version.id}><a href={codeVersionHref(version.id)}>
        {new Date(version.savedAt).toLocaleString('zh-CN')} · {version.note || codeVersionSource(version)}
      </a></li>)}
    </ul> : <p className="code-muted">此脚本暂无保存的代码版本。</p>)}
    <form className="code-form" aria-label="编辑职责说明" onSubmit={save}>
      <label>职责说明
        <textarea rows={3} maxLength={1000} disabled={busy} value={text} onChange={(event) => {
          setText(event.target.value);
          setStatus(undefined);
        }} />
      </label>
      <button type="submit" className="note-button secondary" disabled={busy || text.trim() === note}>{busy ? '保存中…' : '保存职责说明'}</button>
      {status && <p className="code-muted" role={status.error ? 'alert' : 'status'}>{status.text}</p>}
    </form>
  </div>;
}

export default function ProjectDirectoryView({ projectId, directory, versions, initiallyOpen }: {
  projectId: string;
  directory: ProjectDirectory;
  versions: CodeVersion[];
  initiallyOpen: boolean;
}) {
  const [selected, setSelected] = useState('');
  const paths = useMemo(() => projectDirectoryPaths(directory.files), [directory.files]);
  const files = useMemo(() => new Set(directory.files), [directory.files]);
  const notes = useMemo(() => new Map(directory.notes.map(({ path, text }) => [path, text])), [directory.notes]);
  const byPath = useMemo(() => {
    const groups = new Map<string, CodeVersion[]>();
    for (const version of versions) {
      const group = groups.get(version.path) ?? [];
      group.push(version);
      groups.set(version.path, group);
    }
    return groups;
  }, [versions]);

  return <details className="project-directory" open={initiallyOpen}>
    <summary>目录快照（{directory.files.length} 个文件）</summary>
    <p className="code-muted">保存于 {new Date(directory.capturedAt).toLocaleString('zh-CN')}</p>
    <div className="project-directory-layout">
      <ProjectDirectoryTree files={directory.files} renderItem={(node) => {
        const count = byPath.get(node.path)?.length ?? 0;
        return <button type="button" className="project-directory-name" title={node.path}
          aria-pressed={selected === node.path} onClick={() => setSelected(node.path)}>
          <span>{node.name}</span>
          {notes.has(node.path) && <small>有说明</small>}
          {count > 0 && <small>{count} 个版本</small>}
        </button>;
      }} />
      {paths.has(selected) ? <DirectoryItem key={selected} projectId={projectId} path={selected} isFile={files.has(selected)}
        note={notes.get(selected) ?? ''} versions={byPath.get(selected) ?? []} />
        : <p className="code-muted">选择目录或文件查看职责说明与已保存的脚本版本。</p>}
    </div>
  </details>;
}
