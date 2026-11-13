import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { CodeProject, CodeVersion } from '../../types/projectCode';
import { codeVersionHref, codeVersionSource } from '../../utils/projectCode';
import CodeVersionDetail from './CodeVersionDetail';
import CodeVersionForm from './CodeVersionForm';
import ProjectDirectoryImport from './ProjectDirectoryImport';
import ProjectDirectoryView from './ProjectDirectoryView';

function ProjectCard({ project, versions, importStatus, onImport }: {
  project: CodeProject;
  versions: CodeVersion[];
  importStatus?: string;
  onImport: () => void;
}) {
  const { saveProject, deleteProject } = useProjectCodeStore();
  const [draft, setDraft] = useState<CodeProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      await saveProject(project.id, draft);
      setDraft(null);
      setMessage('项目资料已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(project.directory ? '确定删除这个项目及其目录快照和职责说明？' : '确定删除这个空项目？')) return;
    setBusy(true);
    try {
      await deleteProject(project.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="module-card code-project" aria-label={project.name}>
      <h3>{project.name}</h3>
      <p className="code-muted">{versions.length} 个代码版本</p>
      <div className="code-actions">
        {project.repositoryUrl && <a href={project.repositoryUrl} target="_blank" rel="noreferrer">打开 GitHub 仓库</a>}
        {project.tutorialUrl && <a href={project.tutorialUrl} target="_blank" rel="noreferrer">打开教程来源</a>}
        {!draft && <button type="button" className="knowledge-text-button" disabled={busy} onClick={onImport}>
          {project.directory ? '更新目录快照' : '导入目录'}
        </button>}
        {!draft && <button type="button" className="knowledge-text-button" disabled={busy} onClick={() => {
          setDraft(project);
          setMessage('');
        }}>编辑项目资料</button>}
        {versions.length === 0 && !draft && (
          <button type="button" className="knowledge-text-button danger" disabled={busy} onClick={() => void remove()}>
            {project.directory ? '删除项目' : '删除空项目'}
          </button>
        )}
      </div>
      {draft && (
        <form className="code-form" aria-label="编辑项目资料" onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend>编辑项目资料</legend>
            <label>项目名称
              <input value={draft.name} maxLength={120} required onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label>GitHub 仓库地址（可选）
              <input type="url" value={draft.repositoryUrl} onChange={(event) => setDraft({ ...draft, repositoryUrl: event.target.value })} />
            </label>
            <label>教程地址（可选）
              <input type="url" value={draft.tutorialUrl} onChange={(event) => setDraft({ ...draft, tutorialUrl: event.target.value })} />
            </label>
            <button type="submit" className="note-button">保存项目资料</button>
            <button type="button" className="note-button secondary" onClick={() => setDraft(null)}>取消</button>
          </fieldset>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {importStatus && <p role="status">{importStatus}</p>}
      {project.directory && <ProjectDirectoryView projectId={project.id} directory={project.directory}
        versions={versions} initiallyOpen={Boolean(importStatus)} />}
      <ul className="code-link-list">
        {versions.map((version) => (
          <li key={version.id}>
            <a href={codeVersionHref(version.id)}>{version.path}</a>
            <p className="code-muted">{codeVersionSource(version)} · {new Date(version.savedAt).toLocaleString('zh-CN')}</p>
            {version.note && <p className="code-note">{version.note}</p>}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function ProjectCodeWorkspace() {
  const { data, isLoaded, error, load } = useProjectCodeStore();
  const versionId = useWorkspaceStore((state) => state.codeVersionId);
  const [adding, setAdding] = useState(false);
  const [directoryImport, setDirectoryImport] = useState<{ projectId?: string } | null>(null);
  const [importResult, setImportResult] = useState<{ projectId: string; added: number; reused: number } | null>(null);
  const version = data.versions.find((item) => item.id === versionId);
  const project = version && data.projects.find((item) => item.id === version.projectId);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="code-workspace">
      <section className="module-card code-library-header">
        <div className="code-actions">
          <a href="#path">返回成长记录</a>
          {versionId && <a href="#code">所有项目</a>}
        </div>
        <h2>项目代码</h2>
        <p className="code-muted">按项目回看保存的脚本版本和引用它们的学习记录。</p>
        {!isLoaded && <p>正在读取项目代码…</p>}
        {error && <p role="alert">{error}</p>}
        {isLoaded && !error && !versionId && !adding && !directoryImport && <div className="code-actions">
          <button type="button" className="note-button" onClick={() => setAdding(true)}>添加代码版本</button>
          <button type="button" className="note-button secondary" onClick={() => setDirectoryImport({})}>导入项目目录</button>
        </div>}
        {!versionId && adding && (
          <CodeVersionForm onCancel={() => setAdding(false)} onSaved={(id) => {
            setAdding(false);
            window.location.hash = codeVersionHref(id);
          }} />
        )}
        {!versionId && directoryImport && <ProjectDirectoryImport initialProjectId={directoryImport.projectId}
          onCancel={() => setDirectoryImport(null)}
          onSaved={(result) => { setImportResult(result); setDirectoryImport(null); }} />}
      </section>
      {isLoaded && !error && (
        versionId ? (
          version && project ? <CodeVersionDetail key={version.id} version={version} project={project} />
            : <p className="module-card">未找到这个代码版本。<a href="#code">查看所有项目</a></p>
        ) : !directoryImport && (
          <>
            {data.projects.length === 0 && <p className="module-card">还没有项目。导入目录或保存代码版本时可以创建项目。</p>}
            {data.projects.map((project) => (
              <ProjectCard key={project.id} project={project}
                onImport={() => setDirectoryImport({ projectId: project.id })}
                importStatus={importResult?.projectId === project.id ? `目录快照已保存 · 新增 ${importResult.added} 个代码版本 · 复用 ${importResult.reused} 个已有版本` : undefined}
                versions={data.versions.filter((item) => item.projectId === project.id).reverse()} />
            ))}
          </>
        )
      )}
    </div>
  );
}
