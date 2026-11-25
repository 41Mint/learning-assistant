import { useMemo } from 'react';
import { useGrowthStore } from '../../store/growthStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { growthBoardHref } from '../../store/workspaceStore';
import { growthExercises, logLabel } from '../../utils/growth';
import { PRACTICE_IDEAS_LABEL, PRACTICE_RECORDS_LABEL } from '../../utils/growthLabels';
import { entryNames, normalizedName } from '../../utils/knowledge';
import { practiceSourceLookup } from '../../utils/practiceReview';
import { codeVersionHref } from '../../utils/projectCode';
import { codeSearchFields, entrySearchFields, includesWords, logSearchFields, searchWords } from '../../utils/resourceSearch';
import type { SearchRecord, SearchResultSet, SearchScope } from '../../utils/resourceSearch';
import { isEmptyLogContent } from '../../utils/studyLogs';

export const RESOURCE_GROUPS = [
  { page: 'history', label: '学习日志' },
  { page: 'knowledge', label: '知识词条' },
  { page: 'code', label: '代码版本' },
  { page: 'path', label: '实践卡片与卡组' },
] as const;

function searchable(record: SearchRecord) {
  const fields = record.source ? [...record.fields, record.source] : record.fields;
  return { ...record, searchableText: normalizedName(fields.join('\n')) };
}

export function useResourceSearchResults({ query, scope, includeSource, active, individualPractices = false }: {
  query: string;
  scope: SearchScope;
  includeSource: boolean;
  active: boolean;
  individualPractices?: boolean;
}): SearchResultSet {
  const logs = useStudyLogStore((state) => state.logs);
  const { entries, error: knowledgeError } = useKnowledgeStore();
  const { data: code, isLoaded: codeLoaded, error: codeError } = useProjectCodeStore();
  const { outcomes, exercises, hiddenPresetIds, groups: growthGroups, error: growthError } = useGrowthStore();
  const words = useMemo(() => searchWords(query), [query]);
  const records = useMemo(() => {
    if (!active) return { history: [], knowledge: [], code: [], path: [] };
    const projects = new Map(code.projects.map((project) => [project.id, project.name]));
    const completed = new Set(outcomes.map(({ id }) => id));
    const cardGroups = new Map(growthGroups.flatMap((group) => group.cardIds.map((id) => [id, group] as const)));
    const cards = individualPractices ? [] : [
      ...outcomes.map(({ id, title, domains, description, practices }) => ({ id, title, fields: [...domains, description ?? '', ...practices.map(({ note }) => note)] })),
      ...growthExercises({ exercises, hiddenPresetIds }).filter(({ id }) => !completed.has(id))
        .map(({ id, title, domains, action, done }) => ({ id, title, fields: [...domains, action, done] })),
    ];
    const lookupPractice = individualPractices ? practiceSourceLookup(logs, entries, code) : undefined;
    const practices = lookupPractice && outcomes.flatMap((outcome) => outcome.practices.map((practice) => ({ outcome, practice })))
      .sort((a, b) => b.practice.date.localeCompare(a.practice.date))
      .map(({ outcome, practice }) => {
        const { href, relatedLogs, relatedEntries, relatedCode } = lookupPractice(outcome, practice);
        const group = cardGroups.get(outcome.id);
        return searchable({
          href, title: `${outcome.title} · ${practice.date}`, detail: [group?.name, ...outcome.domains].filter(Boolean).join(' · '),
          fields: [practice.note, outcome.title, practice.date, group?.name ?? '', outcome.description ?? '', ...outcome.domains,
            ...relatedLogs.flatMap(logSearchFields), ...relatedEntries.flatMap(entrySearchFields),
            ...relatedCode.flatMap((version) => [...codeSearchFields(version, projects.get(version.projectId) ?? ''), version.content ?? ''])],
          practice: { outcomeId: outcome.id, practiceId: practice.id },
          evidence: { kind: 'practice', text: practice.note },
        });
      });
    return {
      history: [...logs].sort((a, b) => b.date.localeCompare(a.date)).map((log) => searchable({
        href: '#history/' + encodeURIComponent(log.date), title: logLabel(log), tags: log.tags, fields: logSearchFields(log),
        evidence: isEmptyLogContent(log.content, log.date) ? undefined : { kind: 'log', text: log.content },
      })),
      knowledge: [...entries].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')).map((entry) => searchable({
        href: '#knowledge/' + encodeURIComponent(entry.id), title: entry.title, detail: entry.category, fields: entrySearchFields(entry), names: entryNames(entry),
        evidence: { kind: 'entry', text: entry.content },
      })),
      code: [...code.versions].sort((a, b) => b.savedAt - a.savedAt).map((version) => {
        const projectName = projects.get(version.projectId) ?? '';
        return searchable({
          href: codeVersionHref(version.id), title: version.path,
          detail: [projectName, new Date(version.savedAt).toLocaleString('zh-CN')].filter(Boolean).join(' · '),
          fields: codeSearchFields(version, projectName),
          source: includeSource ? version.content ?? undefined : undefined,
          evidence: { kind: 'code', version, projectName },
        });
      }),
      path: practices ?? [
        ...growthGroups.map(({ id, name, cardIds }) => searchable({
          href: growthBoardHref('recent', id), title: name, detail: `卡组 · ${cardIds.length} 张卡片`, fields: [name],
        })),
        ...cards.map(({ id, title, fields }) => {
          const group = cardGroups.get(id);
          const status = completed.has(id) ? PRACTICE_RECORDS_LABEL : PRACTICE_IDEAS_LABEL;
          return searchable({
            href: growthBoardHref(completed.has(id) ? 'recent' : 'try', group?.id, id), title,
            detail: [status, group?.name].filter(Boolean).join(' · '), fields: [title, group?.name ?? '', ...fields],
          });
        }),
      ],
    };
  }, [logs, entries, code, outcomes, exercises, hiddenPresetIds, growthGroups, includeSource, individualPractices, active]);
  const groups = useMemo(() => {
    const exactQuery = normalizedName(query);
    return RESOURCE_GROUPS.filter(({ page }) => scope === 'all' || scope === page).map(({ page, label }) => {
      const items = records[page].filter(({ searchableText }) => includesWords(searchableText, words));
      if (individualPractices && page === 'knowledge') {
        items.sort((a, b) => Number(b.names?.includes(exactQuery) ?? false) - Number(a.names?.includes(exactQuery) ?? false));
      }
      return { page, label: individualPractices && page === 'path' ? '实践记录' : label, items };
    });
  }, [query, records, scope, words, individualPractices]);
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  const checkingCode = (scope === 'all' || scope === 'code' || (scope === 'path' && individualPractices)) && !codeLoaded;
  const errors = [
    (scope === 'all' || scope === 'knowledge') && knowledgeError ? '知识词条暂时无法读取。' : '',
    (scope === 'all' || scope === 'code') && codeError ? '项目代码暂时无法读取。' : '',
    individualPractices && (scope === 'all' || scope === 'path') ? growthError : '',
  ].filter(Boolean);
  return { groups, count, words, checkingCode, errors };
}
