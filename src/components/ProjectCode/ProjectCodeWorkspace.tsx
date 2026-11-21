import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { recycleBinHref, useWorkspaceStore } from '../../store/workspaceStore';
import type { CodeProject, CodeVersion } from '../../types/projectCode';
import { codeVersionHref, codeVersionSource } from '../../utils/projectCode';
import WorkspaceDialog from '../common/WorkspaceDialog';
import InlineReveal from '../common/InlineReveal';
import CodeVersionDetail from './CodeVersionDetail';
import CodeVersionForm from './CodeVersionForm';
import ProjectDirectoryImport from './ProjectDirectoryImport';
import ProjectDirectoryView from './ProjectDirectoryView';

type DirectoryImportResult = { projectId: string; added: number; reused: number };

function ProjectDetailsForm({ project, onCancel, onSaved }: {
  project: CodeProject;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const saveProject = useProjectCodeStore((state) => state.saveProject);
  const [draft, setDraft] = useState(project);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveProject(project.id, draft);
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
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
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="note-button">保存项目资料</button>
        <button type="button" className="note-button secondary" onClick={onCancel}>取消</button>
      </fieldset>
    </form>
  );
}

function ProjectCard({ project, versions, trashedCount, importStatus, importing, formOpen, onImport, onCancelImport, onImported }: {
  project: CodeProject;
  versions: CodeVersion[];
  trashedCount: number;
  importStatus?: string;
  importing: boolean;
  formOpen: boolean;
  onImport: () => void;
  onCancelImport: () => void;
  onImported: (result: DirectoryImportResult) => void;
}) {
  const deleteProject = useProjectCodeStore((state) => state.deleteProject);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const importButton = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const actionsLocked = editing || formOpen;

  return (
    <article className="module-card code-project" aria-label={project.name}>
      <h3>{project.name}</h3>
      <p className="code-muted">{versions.length} 个代码版本</p>
      <div className="code-actions">
        {project.repositoryUrl && <a href={project.repositoryUrl} target="_blank" rel="noreferrer">打开 GitHub 仓库</a>}
        {project.tutorialUrl && <a href={project.tutorialUrl} target="_blank" rel="noreferrer">打开教程来源</a>}
        <button ref={importButton} type="button" className="knowledge-text-button" aria-expanded={importing}
          disabled={actionsLocked} onClick={onImport}>
          {project.directory ? '更新目录快照' : '导入目录'}
        </button>
        <button ref={editButton} type="button" className="knowledge-text-button" aria-expanded={editing} disabled={actionsLocked} onClick={() => {
          setEditing(true);
          setMessage('');
        }}>编辑项目资料</button>
        {versions.length === 0 && (
          <button type="button" className="knowledge-text-button danger" disabled={actionsLocked} onClick={() => setConfirmDelete(true)}>
            删除项目
          </button>
        )}
      </div>
      <InlineReveal open={importing} trigger={importButton}>
        <ProjectDirectoryImport initialProjectId={project.id} onCancel={onCancelImport} onSaved={onImported} />
      </InlineReveal>
      {confirmDelete && <WorkspaceDialog title="删除项目" action="确认删除" destructive
        onSave={() => deleteProject(project.id)} onClose={() => setConfirmDelete(false)}>
        <p>确定从项目列表删除「{project.name}」？</p>
        {trashedCount > 0 ? <p>回收站中的 {trashedCount} 个代码版本仍可恢复。恢复任一版本时，项目{project.directory ? '及目录快照' : ''}也会回到列表。</p>
          : project.directory && <p>已保存的目录快照和职责说明也会被删除，此操作无法撤销。</p>}
      </WorkspaceDialog>}
      {trashedCount > 0 && <p className="code-muted">此项目有 {trashedCount} 个代码版本在<a href={recycleBinHref('code')}>回收站</a>。</p>}
      <InlineReveal open={editing} trigger={editButton}>
        <ProjectDetailsForm project={project} onCancel={() => setEditing(false)} onSaved={() => {
          setEditing(false);
          setMessage('项目资料已保存。');
        }} />
      </InlineReveal>
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

export default function ProjectCodeWorkspace({ adding, setAdding }: { adding: boolean; setAdding: (adding: boolean) => void }) {
  const { data, isLoaded, error, load } = useProjectCodeStore();
  const versionId = useWorkspaceStore((state) => state.codeVersionId);
  const [directoryProjectId, setDirectoryProjectId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<DirectoryImportResult | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const version = data.versions.find((item) => item.id === versionId);
  const archived = data.trash.versions.some((item) => item.id === versionId);
  const project = version && data.projects.find((item) => item.id === version.projectId);
  const projects = data.projects.filter((item) => !item.archived);
  const importing = directoryProjectId !== null;
  const formOpen = adding || importing;
  const cancelImport = () => setDirectoryProjectId(null);
  const finishImport = (result: DirectoryImportResult) => {
    setImportResult(result);
    cancelImport();
  };

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
        {isLoaded && !error && !versionId && <>
          <div className="code-actions">
            <button ref={addButton} type="button" className="note-button" aria-expanded={adding && !importing}
              disabled={formOpen} onClick={() => setAdding(true)}>添加代码版本</button>
            <button ref={importButton} type="button" className="note-button secondary" aria-expanded={directoryProjectId === ''}
              disabled={formOpen} onClick={() => setDirectoryProjectId('')}>导入项目目录</button>
          </div>
          <InlineReveal open={adding && !importing} trigger={addButton}>
            <CodeVersionForm onCancel={() => setAdding(false)} onSaved={(id) => {
              setAdding(false);
              window.location.hash = codeVersionHref(id);
            }} />
          </InlineReveal>
          <InlineReveal open={directoryProjectId === ''} trigger={importButton}>
            <ProjectDirectoryImport onCancel={cancelImport} onSaved={finishImport} />
          </InlineReveal>
        </>}
      </section>
      {isLoaded && !error && (
        versionId ? (
          version && project ? <CodeVersionDetail key={version.id} version={version} project={project} />
            : archived ? <p className="module-card">代码版本已移入回收站。 <a href={recycleBinHref('code')}>打开回收站</a></p>
              : <p className="module-card">未找到这个代码版本。<a href="#code">查看所有项目</a></p>
        ) : (
          <>
            {projects.length === 0 && <p className="module-card">还没有项目。导入目录或保存代码版本时可以创建项目。</p>}
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project}
                trashedCount={data.trash.versions.filter((item) => item.projectId === project.id).length}
                importing={directoryProjectId === project.id} formOpen={formOpen}
                onImport={() => setDirectoryProjectId(project.id)} onCancelImport={cancelImport} onImported={finishImport}
                importStatus={importResult?.projectId === project.id ? `目录快照已保存 · 新增 ${importResult.added} 个代码版本 · 复用 ${importResult.reused} 个已有版本` : undefined}
                versions={data.versions.filter((item) => item.projectId === project.id).reverse()} />
            ))}
          </>
        )
      )}
    </div>
  );
}
