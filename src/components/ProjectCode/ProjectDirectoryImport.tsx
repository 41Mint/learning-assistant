import { useMemo, useState } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { isImportableScript, previewProjectDirectory, projectDirectoryPaths, readDirectoryScripts } from '../../utils/projectDirectory';
import type { DirectoryPreview } from '../../utils/projectDirectory';
import ProjectDirectoryTree from './ProjectDirectoryTree';

export default function ProjectDirectoryImport({ initialProjectId = '', onCancel, onSaved }: {
  initialProjectId?: string;
  onCancel: () => void;
  onSaved: (result: { projectId: string; added: number; reused: number }) => void;
}) {
  const projects = useProjectCodeStore((state) => state.data.projects).filter((project) => !project.archived);
  const importDirectory = useProjectCodeStore((state) => state.importDirectory);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<DirectoryPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pickerMessage, setPickerMessage] = useState('');
  const files = useMemo(() => preview ? [...preview.byPath.keys()].sort() : [], [preview]);
  const paths = useMemo(() => projectDirectoryPaths(files), [files]);
  const previous = projects.find((project) => project.id === projectId)?.directory;
  const lostNotes = previous?.notes.filter(({ path }) => !paths.has(path)).length ?? 0;
  const acceptPreview = (next: DirectoryPreview) => {
    setPreview(next);
    setName(next.root);
    setSelected(new Set());
    setPickerMessage(`已读取「${next.root}」的 ${next.byPath.size} 个文件路径。请在下方查看目录预览；尚未保存。`);
  };
  const nothingPicked = () => setPickerMessage(preview
    ? '没有读取到新文件夹，已保留上次的目录预览。'
    : '未选择文件夹。请选择项目根目录以预览。');

  const choose = (selection: FileList | null) => {
    setError('');
    if (!selection?.length) { nothingPicked(); return; }
    try {
      acceptPreview(previewProjectDirectory(selection));
    } catch (error) {
      setPickerMessage('');
      setError(error instanceof Error ? error.message : '目录读取失败，请重新选择。');
    }
  };
  const save = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setError('');
    setPickerMessage('');
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

  return <form className="project-directory-import" aria-label="导入项目目录" onSubmit={(event) => {
    event.preventDefault();
    void save();
  }}>
    <fieldset disabled={busy} className="project-directory-fields">
      <legend>导入项目目录</legend>
      <p className="code-muted">选择项目根目录后，可预览目录并勾选要一并保存的 .cs 脚本。若浏览器显示「上传」提示，确认后本页会在本地读取所选文件。</p>
      <div className="code-form">
        <label>本地项目文件夹
          <input type="file" ref={(input) => {
            if (!input) return;
            input.webkitdirectory = true;
            const cancelSelection = () => {
              setError('');
              nothingPicked();
            };
            input.addEventListener('cancel', cancelSelection);
            return () => input.removeEventListener('cancel', cancelSelection);
          }} onChange={(event) => {
            choose(event.currentTarget.files);
            event.currentTarget.value = '';
          }} />
        </label>
        {pickerMessage && <p role="status" className="code-muted">{pickerMessage}</p>}
        {error && <p role="alert">{error}</p>}
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
        <p className="code-muted">{files.length} 个文件路径 · 已选 {selected.size} 个脚本{preview.skipped ? ` · 已跳过 ${preview.skipped} 项缓存、构建、配置目录或 .meta 文件` : ''}</p>
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
      <div className="code-actions">
        <button type="submit" className="note-button" disabled={!preview || (!projectId && !name.trim())}>
          {busy ? '保存中…' : '保存目录快照'}
        </button>
        <button type="button" className="note-button secondary" onClick={onCancel}>取消</button>
      </div>
    </fieldset>
  </form>;
}
