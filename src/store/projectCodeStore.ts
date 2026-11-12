import { create } from 'zustand';
import type { CodeLink, CodeProject, CodeTarget, CodeVersion, ProjectCodeData } from '../types/projectCode';
import type { RelationAnnotation } from '../types/relations';
import {
  codeTargetKey, emptyProjectCode, normalizeRepositoryUrl, normalizeScriptPath, normalizeTutorialUrl, parseCodePermalink,
} from '../utils/projectCode';
import { readProjectCode, updateProjectCode } from '../utils/projectCodeStorage';
import { cleanRelationAnnotation } from '../utils/relationAnnotation';
import { generateId } from '../utils/storage';

export type ProjectInput = Omit<CodeProject, 'id'>;
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
  saveVersionDetails: (id: string, note: string, githubUrl: string) => Promise<void>;
  linkVersion: (versionId: string, target: CodeTarget) => Promise<void>;
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

function withLink(links: CodeLink[], versionId: string, target: CodeTarget): CodeLink[] {
  const key = codeTargetKey(target);
  return links.some((link) => link.versionId === versionId && codeTargetKey(link.target) === key)
    ? links
    : [...links, { versionId, target }];
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
      return { ...data, projects: data.projects.map((item) => item.id === id ? project : item) };
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
    linkVersion: (versionId, target) => update((data) => {
      if (!data.versions.some((version) => version.id === versionId)) throw new Error('这个代码版本已不存在，请重新选择。');
      return { ...data, links: withLink(data.links, versionId, target) };
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
