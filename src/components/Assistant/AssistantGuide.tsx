import { useGrowthStore } from '../../store/growthStore';
import { useProjectCodeStore } from '../../store/projectCodeStore';
import { useStudyLogStore } from '../../store/studyLogStore';

export type AssistantStart = 'today' | 'path' | 'code';

export default function AssistantGuide({ page, onAction, onStart }: {
  page: string;
  onAction: (action: 'review' | 'search' | 'practice' | 'code') => void;
  onStart: (page: AssistantStart) => void;
}) {
  const hasNotes = useStudyLogStore((state) => state.logs.some((log) => log.content.trim() && log.content.trim() !== `### ${log.date}`));
  const hasPractice = useGrowthStore((state) => state.outcomes.length > 0);
  const hasCode = useProjectCodeStore((state) => state.data.versions.some((version) => version.content?.trim()));
  const items = [
    hasNotes ? { label: '整理学习日志', description: '挑一篇记录，从原文生成标签和词条建议。', action: 'review' as const }
      : { label: '写第一篇学习记录', description: '记下今天做了什么，之后可以整理成词条。', start: 'today' as const },
    hasPractice ? { label: '找回一次实践', description: '回看做过的事、关联资料，也可以接着设目标。', action: 'practice' as const }
      : { label: '记录第一次实践', description: '在成长记录里保存一件已经做成的事。', start: 'path' as const },
    hasCode ? { label: '问一段代码', description: '选脚本版本和行号，带着片段提问。', action: 'code' as const }
      : { label: '保存一个脚本', description: '导入本地脚本后，可以选中几行提问。', start: 'code' as const },
  ];
  if (page === 'code') items.unshift(items.splice(2, 1)[0]);
  if (page === 'path') items.unshift(items.splice(1, 1)[0]);
  return <section className="assistant-guide" aria-label="开始使用学习智能体">
    <p>你想先做什么？</p>
    {items.map((item) => <button key={item.label} type="button" onClick={() => {
      if (item.start) onStart(item.start);
      else if (item.action) onAction(item.action);
    }}>
      <strong>{item.label} <span aria-hidden="true">→</span></strong><span>{item.description}</span>
    </button>)}
    <button type="button" className="knowledge-text-button" onClick={() => onAction('search')}>查找日志、词条或代码版本</button>
  </section>;
}
