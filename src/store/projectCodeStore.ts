import { create } from 'zustand';
import type { CodeLink, CodeProject, CodeTarget, CodeVersion, ProjectCodeData, ProjectDirectory } from '../types/projectCode';
import type { RelationAnnotation } from '../types/relations';
import {
  codeTargetKey, emptyProjectCode, normalizeRepositoryUrl, normalizeScriptPath, normalizeTutorialUrl, parseCodePermalink,
} from '../utils/projectCode';
import { readProjectCode, updateProjectCode } from '../utils/projectCodeStorage';
import { projectDirectoryPaths } from '../utils/projectDirectory';
import { cleanRelationAnnotation } from '../utils/relationAnnotation';
import { generateId } from '../utils/storage';

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
  data: ProjectCodeData;
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
  deleteVersion: (id: string) => Promise<void>;
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
  async function update(edit: (data: ProjectCodeData) => ProjectCodeData) {
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
          ? data.projects.find((item) => item.id === inputProject.id)
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
      if (!data.projects.some((project) => project.id === id)) throw new Error('这个项目已不存在。');
      const project = makeProject(id, input);
      return { ...data, projects: data.projects.map((item) => item.id === id ? { ...item, ...project } : item) };
    }),
    importDirectory: async ({ project: input, files, scripts }) => {
      const projectId = 'id' in input ? input.id : generateId();
      let added = 0;
      await update((data) => {
        const project = 'id' in input
          ? data.projects.find((item) => item.id === projectId)
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
      const project = data.projects.find((item) => item.id === projectId);
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
    deleteVersion: (id) => update((data) => ({
      ...data,
      versions: data.versions.filter((version) => version.id !== id),
      links: data.links.filter((link) => link.versionId !== id),
    })),
    deleteProject: (id) => update((data) => {
      if (data.versions.some((version) => version.projectId === id)) throw new Error('请先处理该项目下的代码版本。');
      return { ...data, projects: data.projects.filter((project) => project.id !== id) };
    }),
  };
});
