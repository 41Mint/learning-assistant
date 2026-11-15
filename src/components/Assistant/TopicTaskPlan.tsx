import { useState } from 'react';
import { useSkillTreeStore } from '../../store/skillTreeStore';
import { useTaskStore } from '../../store/taskStore';
import type { ChatTaskSuggestion } from '../../types/assistantChat';
import { normalizedName } from '../../utils/knowledge';
import { readSkillTree } from '../../utils/skillPathStorage';
import WorkspaceDialog from '../common/WorkspaceDialog';
import TaskFields from '../SkillTree/TaskFields';

export default function TopicTaskPlan({ topicId, suggestions }: { topicId: string; suggestions: ChatTaskSuggestion[] }) {
  const topic = useSkillTreeStore((state) => state.topics.find(({ id }) => id === topicId));
  const { isLoaded, tasks, addTask } = useTaskStore();
  const [draft, setDraft] = useState<{ title: string; description: string }>();
  const [savedTitle, setSavedTitle] = useState('');
  const titles = new Set(tasks.filter(({ parentSkillId }) => parentSkillId === topicId).map(({ title }) => normalizedName(title)));
  const duplicate = Boolean(draft && titles.has(normalizedName(draft.title)));
  return <section className="assistant-grouping" aria-label="任务建议">
    {suggestions.map(({ title, action, done }) => <article key={title} className="growth-card assistant-grouping-card" aria-label={title}>
      <h4>{title}</h4>
      <p>{action}</p>
      <p><strong>完成条件</strong> {done}</p>
      <button type="button" className="note-button secondary" disabled={!topic || !isLoaded}
        onClick={() => {
          setSavedTitle('');
          setDraft({ title, description: action + '\n\n完成条件\n' + done });
        }}>添加为任务</button>
    </article>)}
    {!topic && <p className="growth-muted">原主题已不可用。</p>}
    {savedTitle && topic && <p role="status">已将「{savedTitle}」保存到「{topic.name}」。</p>}
    {draft && topic && <WorkspaceDialog title="添加为任务" action="保存任务"
      valid={Boolean(normalizedName(draft.title)) && !duplicate && isLoaded} onClose={() => setDraft(undefined)} onSave={() => {
        if (!readSkillTree().topics.some(({ id }) => id === topicId)) throw new Error('原主题已不可用。');
        const title = draft.title.trim();
        addTask(topicId, title, draft.description.trim());
        setSavedTitle(title);
      }}>
      <p className="growth-muted">添加到「{topic.name}」</p>
      <TaskFields title={draft.title} description={draft.description}
        onTitle={(title) => setDraft({ ...draft, title })}
        onDescription={(description) => setDraft({ ...draft, description })} />
      {duplicate && <p role="status">这个主题已有同名任务，可编辑后再保存。</p>}
    </WorkspaceDialog>}
  </section>;
}
