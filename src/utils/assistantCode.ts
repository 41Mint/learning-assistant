import { CHAT_CODE_CONTEXT_LIMIT, CHAT_CODE_LIMIT, CHAT_SCRIPT_LIMIT } from '../types/assistantChat';
import type { ChatCodeRange, ChatScript } from '../types/assistantChat';
import type { CodeProject, CodeVersion } from '../types/projectCode';

export const normalizeScriptLines = (text: string) => text.replace(/\r\n|\r/g, '\n');
export const scriptLines = (text: string) => normalizeScriptLines(text).replace(/\n$/, '').split('\n');
export const lineLabel = ({ startLine, endLine }: Pick<ChatCodeRange, 'startLine' | 'endLine'>) => `第 ${startLine}${startLine === endLine ? '' : `–${endLine}`} 行`;

export function makeCodeExcerpt(version: CodeVersion, startLine: number, text: string, offset = 0) {
  if (!text.trim() || text.length > CHAT_CODE_LIMIT) return undefined;
  const endLine = startLine + text.split('\n').length - 1;
  return { id: JSON.stringify([version.id, startLine, offset, text.length]), versionId: version.id,
    path: version.path, startLine, endLine, text };
}

export function makeScriptReference(version: CodeVersion) {
  return { kind: 'script' as const, id: JSON.stringify(['script', version.id]), versionId: version.id, path: version.path };
}

export function describeScript(version: CodeVersion, project?: CodeProject): ChatScript | undefined {
  const source = normalizeScriptLines(version.content ?? '').replace(/\n$/, '');
  if (!source.trim()) return undefined;
  const countLines = (text: string) => text.split('\n').length;
  const totalLines = countLines(source);
  const sampled = source.length > CHAT_SCRIPT_LIMIT;
  const half = CHAT_SCRIPT_LIMIT / 2;
  const head = source.slice(0, half).replace(/[\uD800-\uDBFF]$/, '');
  const tail = source.slice(-half).replace(/^[\uDC00-\uDFFF]/, '');
  const parts = sampled ? [
    { startLine: 1, endLine: countLines(head), text: head },
    { startLine: totalLines - countLines(tail) + 1, endLine: totalLines, text: tail },
  ] : [{ startLine: 1, endLine: totalLines, text: source }];
  const directoryNotes = project?.directory?.notes.filter(({ path }) => version.path === path || version.path.startsWith(path + '/')) ?? [];
  const notes = [version.note, ...directoryNotes.sort((a, b) => b.path.length - a.path.length).map(({ path, text }) => `${path} · ${text}`)]
    .filter((note) => note.trim()).slice(0, 6).map((note) => note.slice(0, 500));
  return { path: version.path, project: project?.name.slice(0, 120) ?? '', totalLines, sampled, parts, notes };
}

export function surroundingCode(content: string, focus: ChatCodeRange): ChatCodeRange | undefined {
  const lines = scriptLines(content);
  let startLine = Math.max(1, focus.startLine - 5);
  let endLine = Math.min(lines.length, focus.endLine + 5);
  while (startLine <= focus.startLine && endLine >= focus.endLine) {
    const text = lines.slice(startLine - 1, endLine).join('\n');
    if (text.length <= CHAT_CODE_CONTEXT_LIMIT && (text !== focus.text || startLine !== focus.startLine || endLine !== focus.endLine)) {
      return { startLine, endLine, text };
    }
    if (focus.startLine - startLine >= endLine - focus.endLine) startLine += 1;
    else endLine -= 1;
  }
}
