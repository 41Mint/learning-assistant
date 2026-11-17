import { create } from 'zustand';
import type { CodeLink, CodeProject, CodeTarget, CodeVersion, ProjectDirectory, StoredProjectCodeData } from '../types/projectCode';
import type { RelationAnnotation } from '../types/relations';
import {
  codeTargetKey, emptyProjectCode, normalizeRepositoryUrl, normalizeScriptPath, normalizeTutorialUrl, parseCodePermalink,
} from '../utils/projectCode';
import { readProjectCode, updateProjectCode } from '../utils/projectCodeStorage';
import { projectDirectoryPaths } from '../utils/projectDirectory';
import { cleanRelationAnnotation } from '../utils/relationAnnotation';
import { emptyGrowth, validateGrowth } from '../utils/growth';
import { emptyKnowledge, validateKnowledge } from '../utils/knowledge';
import { generateId, STORAGE_KEYS } from '../utils/storage';
import { readStoredLogs } from '../utils/studyLogs';

export type ProjectInput = Pick<CodeProject, 'name' | 'tutorialUrl' | 'repositoryUrl'>;
export interface CodeVersionInput {
  project: { id: string } | ProjectInput;
  path: string;
  fileName?: string;
  content: string | null;
  githubUrl: string;
  note: string;
}

interface ProjectCodeStore {
  data: StoredProjectCodeData;
  isLoaded: boolean;
  error: string;
  load: () => Promise<void>;
  saveVersion: (input: CodeVersionInput, target?: CodeTarget) => Promise<string>;
  saveProject: (id: string, input: ProjectInput) => Promise<void>;
  importDirectory: (input: {
    project: { id: string } | ProjectInput;
    files: string[];
    scripts: { path: string; content: string }[];
  }) => Promise<{ projectId: string; added: number; reused: number }>;
  saveDirectoryNote: (projectId: string, path: string, text: string) => Promise<void>;
  saveVersionDetails: (id: string, note: string, githubUrl: string) => Promise<void>;
  linkVersion: (versionId: string, target: CodeTarget, annotation?: RelationAnnotation) => Promise<void>;
  unlinkVersion: (versionId: string, target: CodeTarget) => Promise<void>;
  annotateLogCode: (versionId: string, logId: string, input: RelationAnnotation) => Promise<void>;
  trashVersion: (id: string) => Promise<void>;
  restoreVersion: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

function makeProject(id: string, input: ProjectInput): CodeProject {
  const name = input.name.trim();
  if (!name) throw new Error('请填写项目名称。');
  return { id, name, tutorialUrl: normalizeTutorialUrl(input.tutorialUrl), repositoryUrl: normalizeRepositoryUrl(input.repositoryUrl) };
}

function verifyRepository(project: CodeProject, repositoryUrl: string): void {
  if (project.repositoryUrl && project.repositoryUrl.toLowerCase() !== repositoryUrl.toLowerCase()) {
    throw new Error('链接指向另一个 GitHub 仓库。请选择对应项目，或先在项目资料里更新仓库地址。');
  }
}

function withLink(links: CodeLink[], versionId: string, target: CodeTarget, annotation?: RelationAnnotation): CodeLink[] {
  const key = codeTargetKey(target);
  return links.some((link) => link.versionId === versionId && codeTargetKey(link.target) === key)
    ? links
    : [...links, { versionId, target, annotation }];
}

export const useProjectCodeStore = create<ProjectCodeStore>((set, get) => {
  let loading: Promise<void> | undefined;
  async function update(edit: (data: StoredProjectCodeData) => StoredProjectCodeData) {
    await get().load();
    if (get().error) throw new Error(get().error);
    const data = await updateProjectCode(edit);
    set({ data });
  }

  return {
    data: emptyProjectCode(),
    isLoaded: false,
    error: '',
    load: () => {
      if (get().isLoaded) return Promise.resolve();
      loading ??= readProjectCode()
        .then((data) => set({ data, isLoaded: true }))
        .catch((error: unknown) => set({
          isLoaded: true,
          error: error instanceof Error ? error.message : '项目代码读取失败，请刷新后重试。',
        }));
      return loading;
    },
    saveVersion: async (input, target) => {
      const source = input.githubUrl.trim() ? parseCodePermalink(input.githubUrl) : null;
      if (input.content === null && !source) throw new Error('请选择 .cs 文件，或填写 GitHub 固定链接。');
      const path = normalizeScriptPath(input.path.trim() || source?.path || input.fileName || '');
      if (source && source.path !== path) throw new Error('项目内路径应与 GitHub 链接中的文件路径一致。');
      if (input.fileName && path.split('/').at(-1) !== input.fileName) throw new Error('项目内路径末尾应与所选文件名一致。');
      const versionId = generateId();
      await update((data) => {
        const inputProject = input.project;
        const project = 'id' in inputProject
          ? data.projects.find((item) => item.id === inputProject.id && !item.archived)
          : makeProject(generateId(), inputProject);
        if (!project) throw new Error('这个项目已不存在，请重新选择。');
        const updatedProject = { ...project };
        if (source) {
          verifyRepository(project, source.repositoryUrl);
          updatedProject.repositoryUrl ||= source.repositoryUrl;
        }
        const projects = 'id' in inputProject
          ? data.projects.map((item) => item.id === project.id ? updatedProject : item)
          : [...data.projects, updatedProject];
        const version: CodeVersion = {
          id: versionId, projectId: project.id, path, content: input.content,
          githubUrl: source?.url ?? '', note: input.note.trim(), savedAt: Date.now(),
        };
        return {
          ...data,
          projects,
          versions: [...data.versions, version],
          links: target ? withLink(data.links, versionId, target) : data.links,
        };
      });
      return versionId;
    },
    saveProject: (id, input) => update((data) => {
      if (!data.projects.some((project) => project.id === id && !project.archived)) throw new Error('这个项目已不存在。');
      const project = makeProject(id, input);
      return { ...data, projects: data.projects.map((item) => item.id === id ? { ...item, ...project } : item) };
    }),
    importDirectory: async ({ project: input, files, scripts }) => {
      const projectId = 'id' in input ? input.id : generateId();
      let added = 0;
      await update((data) => {
        const project = 'id' in input
          ? data.projects.find((item) => item.id === projectId && !item.archived)
          : makeProject(projectId, input);
        if (!project) throw new Error('这个项目已不存在，请重新选择。');
        const paths = projectDirectoryPaths(files);
        const filePaths = new Set(files);
        const capturedAt = Date.now();
        const directory: ProjectDirectory = {
          capturedAt, files,
          notes: project.directory?.notes.filter(({ path }) => paths.has(path)) ?? [],
        };
        const latestByPath = new Map<string, string>();
        for (const version of data.versions) {
          if (version.projectId !== projectId || version.content === null) continue;
          latestByPath.set(version.path, version.content);
        }
        const selected = new Set<string>();
        const versions: CodeVersion[] = [];
        for (const { path, content } of scripts) {
          if (!filePaths.has(path) || selected.has(path)) throw new Error('所选脚本缺失或重复，请重新选择。');
          selected.add(path);
          if (latestByPath.get(path) === content) continue;
          versions.push({ id: generateId(), projectId, path, content, note: '', githubUrl: '', savedAt: capturedAt });
        }
        added = versions.length;
        const updated = { ...project, directory };
        return {
          ...data,
          projects: 'id' in input ? data.projects.map((item) => item.id === projectId ? updated : item) : [...data.projects, updated],
          versions: [...data.versions, ...versions],
        };
      });
      return { projectId, added, reused: scripts.length - added };
    },
    saveDirectoryNote: (projectId, path, input) => update((data) => {
      const project = data.projects.find((item) => item.id === projectId && !item.archived);
      const directory = project?.directory;
      if (!directory || !directory.files.some((file) => file === path || file.startsWith(path + '/'))) {
        throw new Error('这个路径已不在当前目录快照中，请重新选择。');
      }
      const text = input.trim();
      const notes = directory.notes.filter((note) => note.path !== path);
      if (text) notes.push({ path, text });
      return {
        ...data,
        projects: data.projects.map((item) => item === project ? { ...item, directory: { ...directory, notes } } : item),
      };
    }),
    saveVersionDetails: (id, note, githubUrl) => update((data) => {
      const version = data.versions.find((item) => item.id === id);
      if (!version) throw new Error('这个代码版本已不存在。');
      let projects = data.projects;
      let address = version.githubUrl;
      let path = version.path;
      if (!address && githubUrl.trim()) {
        const source = parseCodePermalink(githubUrl);
        const matchesFileName = !path.includes('/') && source.path.split('/').at(-1) === path;
        if (source.path !== path && !matchesFileName) throw new Error('请填写指向同一项目内路径的固定链接。');
        const project = data.projects.find((item) => item.id === version.projectId)!;
        verifyRepository(project, source.repositoryUrl);
        if (!project.repositoryUrl) {
          projects = projects.map((item) => item.id === project.id ? { ...item, repositoryUrl: source.repositoryUrl } : item);
        }
        address = source.url;
        path = source.path;
      }
      const updated = { ...version, path, note: note.trim(), githubUrl: address };
      return { ...data, projects, versions: data.versions.map((item) => item.id === id ? updated : item) };
    }),
    linkVersion: (versionId, target, annotation) => update((data) => {
      if (!data.versions.some((version) => version.id === versionId)) throw new Error('这个代码版本已不存在，请重新选择。');
      return { ...data, links: withLink(data.links, versionId, target, annotation) };
    }),
    unlinkVersion: (versionId, target) => update((data) => ({
      ...data,
      links: data.links.filter((link) => link.versionId !== versionId || codeTargetKey(link.target) !== codeTargetKey(target)),
    })),
    annotateLogCode: (versionId, logId, input) => update((data) => {
      const annotation = cleanRelationAnnotation(input);
      const link = data.links.find((item) => item.versionId === versionId && item.target.kind === 'log' && item.target.id === logId);
      if (!link) throw new Error('这条关联已不存在。');
      return { ...data, links: data.links.map((item) => item === link ? { ...item, annotation } : item) };
    }),
    trashVersion: (id) => update((data) => {
      const version = data.versions.find((item) => item.id === id);
      if (!version) throw new Error('这个代码版本已不存在。');
      return {
        ...data,
        versions: data.versions.filter((item) => item.id !== id),
        links: data.links.filter((link) => link.versionId !== id),
        trash: {
          versions: [...data.trash.versions, { ...version, deletedAt: Date.now() }],
          links: [...data.trash.links, ...data.links.filter((link) => link.versionId === id)],
        },
      };
    }),
    restoreVersion: (id) => update((data) => {
      const candidate = data.trash.versions.find((version) => version.id === id);
      if (!candidate) throw new Error('这个代码版本已不在回收站。');
      const { deletedAt: _deletedAt, ...version } = candidate;
      const archivedLinks = data.trash.links.filter((link) => link.versionId === id);
      const targetKinds = new Set(archivedLinks.map(({ target }) => target.kind));
      const logs = new Set(targetKinds.has('log') ? readStoredLogs().map((log) => log.id) : []);
      const rawKnowledge = targetKinds.has('entry') ? localStorage.getItem(STORAGE_KEYS.KNOWLEDGE) : null;
      const knowledge = rawKnowledge === null ? emptyKnowledge() : validateKnowledge(JSON.parse(rawKnowledge));
      const entries = new Set([...knowledge.entries, ...knowledge.trash.entries].map((entry) => entry.id));
      const rawGrowth = targetKinds.has('practice') ? localStorage.getItem(STORAGE_KEYS.GROWTH) : null;
      const growth = rawGrowth === null ? emptyGrowth() : validateGrowth(JSON.parse(rawGrowth));
      const practices = new Map(growth.outcomes.map((outcome) => [outcome.id, new Set(outcome.practices.map((practice) => practice.id))]));
      const validLinks = archivedLinks.filter(({ target }) => {
        if (target.kind === 'log') return logs.has(target.id);
        if (target.kind === 'entry') return entries.has(target.id);
        return practices.get(target.outcomeId)?.has(target.id);
      });
      return {
        ...data,
        projects: data.projects.map((project) => {
          if (project.id !== version.projectId || !project.archived) return project;
          const { archived: _archived, ...restored } = project;
          return restored;
        }),
        versions: [...data.versions, version].sort((a, b) => a.savedAt - b.savedAt),
        links: [...data.links, ...validLinks],
        trash: {
          versions: data.trash.versions.filter((item) => item.id !== id),
          links: data.trash.links.filter((link) => link.versionId !== id),
        },
      };
    }),
    deleteProject: (id) => update((data) => {
      const project = data.projects.find((item) => item.id === id);
      if (!project || project.archived) throw new Error('这个项目已从列表移除。');
      if (data.versions.some((version) => version.projectId === id)) throw new Error('请先处理该项目下的代码版本。');
      if (data.trash.versions.some((version) => version.projectId === id)) {
        return { ...data, projects: data.projects.map((item) => item === project ? { ...item, archived: true } : item) };
      }
      return { ...data, projects: data.projects.filter((project) => project.id !== id) };
    }),
  };
});
