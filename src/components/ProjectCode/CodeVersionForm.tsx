import { useState } from 'react';
import type { FormEvent } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import type { CodeTarget } from '../../types/projectCode';
import { readScriptFile } from '../../utils/projectCode';

interface CodeVersionFormProps {
  target?: CodeTarget;
  onSaved: (id: string) => void;
  onCancel: () => void;
}

export default function CodeVersionForm({ target, onSaved, onCancel }: CodeVersionFormProps) {
  const projects = useProjectCodeStore((state) => state.data.projects);
  const saveVersion = useProjectCodeStore((state) => state.saveVersion);
  const [projectId, setProjectId] = useState(projects.length === 1 ? projects[0].id : '');
  const [name, setName] = useState('');
  const [tutorialUrl, setTutorialUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const id = await saveVersion({
        project: projectId ? { id: projectId } : { name, tutorialUrl, repositoryUrl: '' },
        path,
        fileName: file?.name,
        content: file ? await readScriptFile(file) : null,
        githubUrl,
        note,
      }, target);
      onSaved(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : '代码保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="code-form" aria-label="保存代码版本" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>保存代码版本</legend>
        {projects.length > 0 && (
          <label>所属项目
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">新建项目</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
        )}
        {!projectId && (
          <>
            <label>项目名称
              <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>教程地址（可选）
              <input type="url" value={tutorialUrl} onChange={(event) => setTutorialUrl(event.target.value)} />
            </label>
          </>
        )}
        <p className="code-muted">选一个本地脚本，或粘贴 GitHub 固定链接。也可以同时保存同一版本的文件和链接。</p>
        <label>本地 .cs 文件
          <input type="file" accept=".cs" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <label>项目内路径（可选）
          <input value={path} onChange={(event) => setPath(event.target.value)} placeholder={file?.name ?? 'Assets/Scripts/InputManager.cs'} maxLength={1024} />
        </label>
        <p className="code-muted">留空时使用链接中的路径或所选文件名。</p>
        <label>GitHub 固定链接
          <input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="在 GitHub 文件页按 y 后复制地址" />
        </label>
        <label>版本说明（可选）
          <textarea rows={2} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="例如：第一次实现点击判定" />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="note-button">{busy ? '保存中…' : '保存版本'}</button>
        <button type="button" className="note-button secondary" onClick={onCancel}>取消</button>
      </fieldset>
    </form>
  );
}
