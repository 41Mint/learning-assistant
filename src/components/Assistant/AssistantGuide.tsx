import { useGrowthStore } from '../../store/growthStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';

export type AssistantStart = 'today' | 'path';
type GuideAction = 'review' | 'search' | 'code';
type GuideItem = { label: string; description: string } & ({ action: GuideAction; start?: never } | { start: AssistantStart; action?: never });

export default function AssistantGuide({ page, onAction, onStart }: {
  page: string;
  onAction: (action: GuideAction) => void;
  onStart: (page: AssistantStart) => void;
}) {
  const hasNotes = useStudyLogStore((state) => state.logs.some((log) => log.content.trim() && log.content.trim() !== `### ${log.date}`));
  const hasPractice = useGrowthStore((state) => state.outcomes.length > 0);
  const hasCode = useProjectCodeStore((state) => state.data.versions.some((version) => version.content?.trim()));
  const items: GuideItem[] = [
    hasNotes ? { label: '整理学习日志', description: '挑一篇记录，从原文生成标签和词条建议。', action: 'review' as const }
      : { label: '写第一篇学习记录', description: '记下今天做了什么，之后可以整理成词条。', start: 'today' as const },
    hasCode ? { label: '问一段代码', description: '选脚本版本和行号，带着片段提问。', action: 'code' as const }
      : { label: '保存一个脚本', description: '导入本地脚本后，可以选中几行提问。', action: 'code' as const },
    { label: '查找资料', description: '查找本地资料、围绕结果提问，或从记录进入复盘。', action: 'search' as const },
  ];
  if (!hasPractice) items.splice(1, 0, { label: '记录第一次实践', description: '在成长记录里保存一件已经做成的事。', start: 'path' as const });
  const preferred = page === 'code' ? items.findIndex((item) => item.action === 'code')
    : page === 'path' ? items.findIndex((item) => hasPractice ? item.action === 'search' : item.start === 'path') : -1;
  if (preferred > 0) items.unshift(items.splice(preferred, 1)[0]);
  return <section className="assistant-guide" aria-label="开始使用学习智能体">
    {items.map((item) => <button key={item.label} type="button" onClick={() => {
      if ('start' in item && item.start) onStart(item.start);
      else if (item.action) onAction(item.action);
    }}>
      <strong>{item.label} <span aria-hidden="true">→</span></strong><span>{item.description}</span>
    </button>)}
  </section>;
}
