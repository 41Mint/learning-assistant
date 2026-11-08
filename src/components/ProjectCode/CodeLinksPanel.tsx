import { useState } from 'react';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import type { CodeTarget, CodeVersion } from '../../types/projectCode';
import { codeTargetKey, codeVersionHref, codeVersionLabel, codeVersionSource } from '../../utils/projectCode';
import CodeVersionForm from './CodeVersionForm';

interface CodeLinksPanelProps {
  target: Exclude<CodeTarget, { kind: 'practice' }>;
  title: string;
}

export default function CodeLinksPanel({ target, title }: CodeLinksPanelProps) {
  const { data, isLoaded, error, linkVersion, unlinkVersion } = useProjectCodeStore();
  const [selected, setSelected] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const targetKey = codeTargetKey(target);
  const linkedIds = new Set(data.links.filter((link) => codeTargetKey(link.target) === targetKey).map((link) => link.versionId));
  const linked = data.versions.filter((version) => linkedIds.has(version.id));
  const available = data.versions.filter((version) => !linkedIds.has(version.id)).reverse();
  const projectName = (version: CodeVersion) => data.projects.find((project) => project.id === version.projectId)?.name;

  const change = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await action();
      setSelected('');
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新关联失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="code-links" aria-label={title}>
      <details>
        <summary>{title}（{linked.length}）</summary>
        {!isLoaded && <p className="code-muted">正在读取项目代码…</p>}
        {error && <p role="alert">{error}</p>}
        {linked.length > 0 && (
          <ul className="code-link-list">
            {linked.map((version) => (
              <li key={version.id}>
                <a href={codeVersionHref(version.id)}>{version.path}</a>
                <p className="code-muted">{projectName(version)} · {codeVersionSource(version)} · {new Date(version.savedAt).toLocaleString('zh-CN')}</p>
                {version.note && <p>{version.note}</p>}
                <button type="button" className="knowledge-text-button" disabled={busy}
                  onClick={() => void change(() => unlinkVersion(version.id, target), '已解除代码关联。')}>解除代码关联</button>
              </li>
            ))}
          </ul>
        )}
        {isLoaded && !error && available.length > 0 && (
          <div className="code-form">
            <label>选择已有代码版本
              <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value="">请选择</option>
                {available.map((version) => (
                  <option key={version.id} value={version.id}>
                    {codeVersionLabel(version, projectName(version))}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="note-button secondary" disabled={busy || !available.some((version) => version.id === selected)}
              onClick={() => void change(() => linkVersion(selected, target), '已关联代码版本。')}>关联所选版本</button>
          </div>
        )}
        {isLoaded && !error && target.kind === 'log' && !adding && (
          <button type="button" className="note-button secondary" onClick={() => { setMessage(''); setAdding(true); }}>添加代码版本</button>
        )}
        {adding && (
          <CodeVersionForm target={target} onCancel={() => setAdding(false)} onSaved={() => {
            setAdding(false);
            setMessage('代码版本已保存并关联到这篇日志。');
          }} />
        )}
        {isLoaded && !error && data.versions.length === 0 && target.kind !== 'log' && (
          <p className="code-muted">可从学习日志或<a href="#code">项目代码</a>保存一个版本，再在这里关联。</p>
        )}
        {message && <p role="status">{message}</p>}
      </details>
    </section>
  );
}
