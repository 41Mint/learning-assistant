import { useMemo, useState } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { isImportableScript, previewProjectDirectory, projectDirectoryPaths, readDirectoryScripts } from '../../utils/projectDirectory';
import FocusEditor from '../common/FocusEditor';
import ProjectDirectoryTree from './ProjectDirectoryTree';

export default function ProjectDirectoryImport({ initialProjectId = '', onCancel, onSaved }: {
  initialProjectId?: string;
  onCancel: () => void;
  onSaved: (result: { projectId: string; added: number; reused: number }) => void;
}) {
  const projects = useProjectCodeStore((state) => state.data.projects);
  const importDirectory = useProjectCodeStore((state) => state.importDirectory);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof previewProjectDirectory> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const files = useMemo(() => preview ? [...preview.byPath.keys()].sort() : [], [preview]);
  const previous = projects.find((project) => project.id === projectId)?.directory;
  const lostNotes = useMemo(() => {
    if (!preview || !previous?.notes.length) return 0;
    const paths = projectDirectoryPaths(files);
    return previous.notes.filter(({ path }) => !paths.has(path)).length;
  }, [preview, previous, files]);

  const choose = (selection: FileList | null) => {
    if (!selection?.length) return;
    setError('');
    setSelected(new Set());
    try {
      const next = previewProjectDirectory(selection);
      setPreview(next);
      setName(next.root);
    } catch (error) {
      setPreview(null);
      setError(error instanceof Error ? error.message : '目录读取失败，请重新选择。');
    }
  };
  const save = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setError('');
    try {
      const scripts = await readDirectoryScripts(preview.byPath, selected);
      const result = await importDirectory({ project: projectId ? { id: projectId } : { name, repositoryUrl: '', tutorialUrl: '' }, files, scripts });
      onSaved(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : '项目目录保存失败，请重试。');
    } finally { setBusy(false); }
  };
  const toggle = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelected(next);
  };

  return <FocusEditor title="导入项目目录" formLabel="导入项目目录" saveLabel="保存目录快照" cancelLabel="取消"
    description="选择项目根目录，预览结构，再勾选要保存正文的 .cs 脚本。"
    saveDisabled={!preview || (!projectId && !name.trim())} busy={busy} error={error} onSave={() => void save()} onCancel={onCancel}>
    <fieldset disabled={busy} className="project-directory-fields">
      <div className="code-form">
        <label>本地项目文件夹
          <input type="file" ref={(input) => { if (input) input.webkitdirectory = true; }} onChange={(event) => {
            choose(event.currentTarget.files);
            event.currentTarget.value = '';
          }} />
        </label>
        {projects.length > 0 && <label>保存到
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">新建项目</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>}
        {!projectId && <label>项目名称
          <input value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} />
        </label>}
      </div>
      {preview && <>
        <h3>{preview.root}</h3>
        <p className="code-muted">{files.length} 个文件路径 · 已选 {selected.size} 个脚本{preview.skipped ? ` · 已跳过 ${preview.skipped} 个缓存、构建或 .meta 文件` : ''}</p>
        <p className="code-muted">可勾选不超过 512 KB 的 .cs 文件。只保存勾选的脚本正文。</p>
        {previous && <p className="code-muted">本次保存会更新目录快照，已有代码版本仍可查看。{lostNotes > 0 && `新快照缺少 ${lostNotes} 条职责说明对应的路径，保存后会移除这些说明。`}</p>}
        <ProjectDirectoryTree files={files} renderItem={(node) => {
          const file = preview.byPath.get(node.path);
          if (!file) return <span>{node.name}</span>;
          if (!isImportableScript(node.path, file)) return <span title={node.path}>{node.name}</span>;
          return <label className="project-directory-check">
            <input type="checkbox" aria-label={`保存脚本 ${node.path}`} checked={selected.has(node.path)} onChange={() => toggle(node.path)} />
            {node.name}
          </label>;
        }} />
      </>}
    </fieldset>
  </FocusEditor>;
}
