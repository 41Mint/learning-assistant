import type { RelationAnnotation } from './relations';

export interface ProjectDirectory {
  capturedAt: number;
  files: string[];
  notes: { path: string; text: string }[];
}

export interface CodeProject {
  id: string;
  name: string;
  tutorialUrl: string;
  repositoryUrl: string;
  directory?: ProjectDirectory;
}

export interface CodeVersion {
  id: string;
  projectId: string;
  path: string;
  content: string | null;
  githubUrl: string;
  note: string;
  savedAt: number;
}

export type CodeTarget =
  | { kind: 'log'; id: string }
  | { kind: 'entry'; id: string }
  | { kind: 'practice'; id: string; outcomeId: string };

export interface CodeLink {
  versionId: string;
  target: CodeTarget;
  annotation?: RelationAnnotation;
}

export interface ProjectCodeData {
  version: 1;
  projects: CodeProject[];
  versions: CodeVersion[];
  links: CodeLink[];
}
