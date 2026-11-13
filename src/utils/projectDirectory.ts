import { isProjectRelativePath, MAX_SCRIPT_BYTES, readScriptFile } from './projectCode';

const excludedRootFolders = new Set(['.git', '.vs', '.idea', 'library', 'temp', 'obj', 'logs', 'usersettings', 'build', 'builds']);

export function projectDirectoryPaths(files: readonly string[]): Set<string> {
  const paths = new Set(files);
  for (const path of files) {
    for (let slash = path.indexOf('/'); slash >= 0; slash = path.indexOf('/', slash + 1)) paths.add(path.slice(0, slash));
  }
  return paths;
}

export interface ProjectDirectoryNode {
  name: string;
  path: string;
  children: ProjectDirectoryNode[] | null;
}

export function buildProjectDirectoryTree(files: readonly string[]): ProjectDirectoryNode[] {
  const childrenByFolder = new Map<string, ProjectDirectoryNode[]>([['', []]]);
  for (const path of files) {
    const parts = path.split('/');
    let parent = '';
    for (const name of parts.slice(0, -1)) {
      const folder = parent ? parent + '/' + name : name;
      if (!childrenByFolder.has(folder)) {
        const children: ProjectDirectoryNode[] = [];
        childrenByFolder.set(folder, children);
        childrenByFolder.get(parent)!.push({ name, path: folder, children });
      }
      parent = folder;
    }
    childrenByFolder.get(parent)!.push({ name: parts.at(-1)!, path, children: null });
  }
  for (const children of childrenByFolder.values()) {
    children.sort((a, b) => Number(Boolean(b.children)) - Number(Boolean(a.children)) || a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
  }
  return childrenByFolder.get('')!;
}

export function previewProjectDirectory(files: FileList) {
  const byPath = new Map<string, File>();
  let root = '';
  let skipped = 0;
  for (const file of files) {
    const relative = file.webkitRelativePath;
    const separator = relative.indexOf('/');
    const folder = relative.slice(0, separator);
    const path = relative.slice(separator + 1);
    if (separator < 1 || (root && root !== folder)) {
      throw new Error('无法读取项目相对路径，请选择一个本地项目文件夹。');
    }
    root = folder;
    const nextSlash = path.indexOf('/');
    if ((nextSlash >= 0 && excludedRootFolders.has(path.slice(0, nextSlash).toLowerCase())) || /\.meta$/i.test(path)) {
      skipped++;
      continue;
    }
    if (!isProjectRelativePath(path)) throw new Error(`路径「${path}」无法保存，请检查目录名称。`);
    byPath.set(path, file);
  }
  if (!byPath.size) throw new Error('这个文件夹中没有可保存的项目路径。');
  return { root, byPath, skipped };
}

export function isImportableScript(path: string, file: File): boolean {
  return /\.cs$/i.test(path) && path === path.trim() && file.size <= MAX_SCRIPT_BYTES;
}

export async function readDirectoryScripts(byPath: ReadonlyMap<string, File>, selected: ReadonlySet<string>) {
  const scripts: { path: string; content: string }[] = [];
  for (const path of selected) {
    const file = byPath.get(path);
    if (!file) throw new Error(`未找到所选文件「${path}」。请重新选择项目目录。`);
    try {
      scripts.push({ path, content: await readScriptFile(file) });
    } catch (error) {
      throw new Error(`${path}：${error instanceof Error ? error.message : '无法读取脚本。'}`);
    }
  }
  return scripts;
}
