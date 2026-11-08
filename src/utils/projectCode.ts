import type { CodeLink, CodeProject, CodeTarget, CodeVersion, ProjectCodeData } from '../types/projectCode';
import type { GrowthOutcome, GrowthPractice, KnowledgeEntry } from '../types';

export const MAX_SCRIPT_BYTES = 512 * 1024;
const MAX_PATH_LENGTH = 1024;
const GITHUB_ORIGIN = 'https://github.com';
const ownerPattern = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const repositoryPattern = /^[a-z\d_.-]+$/i;

export const emptyProjectCode = (): ProjectCodeData => ({ version: 1, projects: [], versions: [], links: [] });

export function normalizeScriptPath(input: string): string {
  const path = input.trim().replaceAll('\\', '/');
  const parts = path.split('/');
  const hasControl = Array.from(path).some((character) => character.charCodeAt(0) < 32 || character === '\u007f');
  if (path.length > MAX_PATH_LENGTH || !/\.cs$/i.test(path) || hasControl
    || parts.some((part) => !part || part === '.' || part === '..' || /[<>:"|?*]/.test(part))) {
    throw new Error('请填写项目内的 .cs 路径，例如 Assets/Scripts/InputManager.cs。');
  }
  return path;
}

function githubUrl(input: string): URL {
  const url = new URL(input.trim());
  if (url.origin !== GITHUB_ORIGIN || url.username || url.password) throw new Error('请使用 github.com 的 HTTPS 地址。');
  return url;
}

function repositoryAddress(owner: string, name: string): string {
  if (!ownerPattern.test(owner) || !repositoryPattern.test(name) || name === '.' || name === '..') {
    throw new Error('GitHub 仓库地址格式不正确。');
  }
  return GITHUB_ORIGIN + '/' + owner + '/' + name;
}

export function normalizeRepositoryUrl(input: string): string {
  if (!input.trim()) return '';
  try {
    const url = githubUrl(input);
    const parts = url.pathname.replace(/\/$/, '').slice(1).split('/');
    if (parts.length !== 2 || url.search || url.hash) throw new Error();
    return repositoryAddress(parts[0], parts[1].replace(/\.git$/i, ''));
  } catch {
    throw new Error('请填写 GitHub 仓库首页地址，例如 https://github.com/账号/仓库。');
  }
}

export function parseCodePermalink(input: string) {
  try {
    const url = githubUrl(input);
    const [owner, repo, view, revision, ...parts] = url.pathname.slice(1).split('/');
    if (view !== 'blob' || !revision || !/^[a-f\d]{40}$/i.test(revision) || !parts.length) throw new Error();
    const decoded = parts.map(decodeURIComponent);
    if (decoded.some((part) => /[/\\]/.test(part))) throw new Error();
    const path = normalizeScriptPath(decoded.join('/'));
    if (path !== decoded.join('/')) throw new Error();
    const repositoryUrl = repositoryAddress(owner, repo);
    const commit = revision.toLowerCase();
    const lineAnchor = /^#L[1-9]\d*(?:-L[1-9]\d*)?$/.test(url.hash) ? url.hash : '';
    return {
      path,
      commit,
      repositoryUrl,
      url: repositoryUrl + '/blob/' + commit + '/' + decoded.map(encodeURIComponent).join('/') + lineAnchor,
    };
  } catch {
    throw new Error('请使用指向具体提交的 GitHub .cs 文件链接。在 GitHub 文件页按 y 后复制地址。');
  }
}

export function normalizeTutorialUrl(input: string): string {
  if (!input.trim()) return '';
  try {
    const url = new URL(input.trim());
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url.href;
  } catch { /* 用统一提示处理无效地址。 */ }
  throw new Error('请填写以 https:// 或 http:// 开头的教程地址。');
}

function validateScriptText(content: string): void {
  if (content.includes('\0') || new TextEncoder().encode(content).byteLength > MAX_SCRIPT_BYTES) {
    throw new Error('请选择不超过 512 KB 的 UTF-8 .cs 文本文件。');
  }
}

export async function readScriptFile(file: File): Promise<string> {
  if (!/\.cs$/i.test(file.name)) throw new Error('请选择 .cs 文件。');
  if (file.size > MAX_SCRIPT_BYTES) throw new Error('脚本超过 512 KB，请选择较小的 .cs 文件。');
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error('脚本读取失败，请检查文件是否使用 UTF-8 编码。');
  }
  validateScriptText(content);
  return content;
}

export function codeTargetKey(target: CodeTarget): string {
  return JSON.stringify(target.kind === 'practice'
    ? [target.kind, target.outcomeId, target.id]
    : [target.kind, target.id]);
}

export function codeVersionHref(id: string): string {
  return '#code/' + encodeURIComponent(id);
}

export function codeVersionSource(version: CodeVersion): string {
  if (version.content === null) return 'GitHub 固定链接';
  return version.githubUrl ? '本地快照 · GitHub 来源' : '本地快照';
}

export function codeVersionLabel(version: CodeVersion, projectName?: string): string {
  return [
    projectName,
    version.path,
    version.note.slice(0, 80) || codeVersionSource(version),
    new Date(version.savedAt).toLocaleString('zh-CN'),
  ].filter(Boolean).join(' · ');
}

export function practiceCodeIds(outcomeId: string, practice: GrowthPractice, links: CodeLink[]): string[] {
  // 先前保存的实践关联仍可读。明确保存的空选择也优先于旧关联。
  return practice.codeVersionIds ?? links
    .filter(({ target }) => target.kind === 'practice' && target.outcomeId === outcomeId && target.id === practice.id)
    .map((link) => link.versionId);
}

export function entryCodeIds(entry: KnowledgeEntry, links: CodeLink[]): string[] {
  return entry.codeVersionIds ?? links
    .filter(({ target }) => target.kind === 'entry' && target.id === entry.id)
    .map((link) => link.versionId);
}

export function effectiveCodeLinks(data: ProjectCodeData, outcomes: GrowthOutcome[], entries: KnowledgeEntry[]): CodeLink[] {
  const knownVersions = new Set(data.versions.map((version) => version.id));
  const editedTargets = new Set<string>();
  const references: CodeLink[] = [];
  const add = (target: CodeTarget, versionIds?: string[]) => {
    if (versionIds === undefined) return;
    editedTargets.add(codeTargetKey(target));
    for (const versionId of versionIds) {
      if (knownVersions.has(versionId)) references.push({ versionId, target });
    }
  };
  for (const entry of entries) add({ kind: 'entry', id: entry.id }, entry.codeVersionIds);
  for (const outcome of outcomes) {
    for (const practice of outcome.practices) {
      add({ kind: 'practice', id: practice.id, outcomeId: outcome.id }, practice.codeVersionIds);
    }
  }
  return [...data.links.filter((link) => !editedTargets.has(codeTargetKey(link.target))), ...references];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isProject(value: unknown): value is CodeProject {
  return isRecord(value) && nonempty(value.id) && nonempty(value.name)
    && typeof value.repositoryUrl === 'string' && normalizeRepositoryUrl(value.repositoryUrl) === value.repositoryUrl
    && typeof value.tutorialUrl === 'string' && normalizeTutorialUrl(value.tutorialUrl) === value.tutorialUrl;
}

function isVersion(value: unknown): value is CodeVersion {
  if (!isRecord(value) || !nonempty(value.id) || !nonempty(value.projectId)
    || typeof value.path !== 'string' || normalizeScriptPath(value.path) !== value.path
    || typeof value.note !== 'string' || typeof value.savedAt !== 'number'
    || value.savedAt < 0 || !Number.isFinite(new Date(value.savedAt).getTime())
    || typeof value.githubUrl !== 'string' || (value.content !== null && typeof value.content !== 'string')) return false;
  if (value.content !== null) validateScriptText(value.content);
  if (!value.githubUrl) return value.content !== null;
  const source = parseCodePermalink(value.githubUrl);
  return source.url === value.githubUrl && source.path === value.path;
}

function isLink(value: unknown): value is CodeLink {
  if (!isRecord(value) || !nonempty(value.versionId) || !isRecord(value.target) || !nonempty(value.target.id)) return false;
  const { kind, outcomeId } = value.target;
  return kind === 'log' || kind === 'entry' || (kind === 'practice' && nonempty(outcomeId));
}

export function validateProjectCode(value: unknown): ProjectCodeData {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.projects) || !value.projects.every(isProject)
    || !Array.isArray(value.versions) || !value.versions.every(isVersion)
    || !Array.isArray(value.links) || !value.links.every(isLink)) {
    throw new Error('项目代码数据格式不正确。');
  }
  const projectIds = new Set(value.projects.map((project) => project.id));
  const versionIds = new Set(value.versions.map((version) => version.id));
  const linkKeys = new Set(value.links.map((link) => JSON.stringify([link.versionId, codeTargetKey(link.target)])));
  if (projectIds.size !== value.projects.length || versionIds.size !== value.versions.length || linkKeys.size !== value.links.length
    || value.versions.some((version) => !projectIds.has(version.projectId))
    || value.links.some((link) => !versionIds.has(link.versionId))) {
    throw new Error('项目代码数据中存在重复或无效的关联。');
  }
  return { version: 1, projects: value.projects, versions: value.versions, links: value.links };
}
