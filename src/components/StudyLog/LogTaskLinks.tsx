import { useState } from 'react';
import type { StudyLog } from '../../types';
import { useStudyLogStore } from '../../store/studyLogStore';
import { useTaskStore } from '../../store/taskStore';
import { useSkillTreeStore } from '../../store/skillTreeStore';
import { topicTaskHref, workspaceResourceTarget } from '../../store/workspaceStore';
import ReferenceChoices from '../common/ReferenceChoices';
import WorkspaceDialog from '../common/WorkspaceDialog';

export default function LogTaskLinks({ log }: { log: StudyLog }) {
  const { tasks, isLoaded } = useTaskStore();
  const topics = useSkillTreeStore((state) => state.topics);
  const setLogTasks = useStudyLogStore((state) => state.setLogTasks);
  const [selection, setSelection] = useState<{ previous: string[]; current: string[] }>();
  const taskIds = log.taskIds ?? [];
  const options = tasks.map(({ id, title, description, parentSkillId, completed }) => {
    const topic = topics.find((topic) => topic.id === parentSkillId)?.name;
    return { id, title, topic, label: [title, topic, completed ? '已完成' : ''].filter(Boolean).join(' · '), fields: [description] };
  });
  const linked = taskIds.flatMap((id) => options.find((task) => task.id === id) ?? []);

  return <section className="log-task-links" aria-label="关联任务">
    <div className="log-task-heading">
      <h3>关联任务{linked.length > 0 ? `（${linked.length}）` : ''}</h3>
      {isLoaded && (tasks.length > 0 || taskIds.length > 0
        ? <button type="button" className="workspace-button" onClick={() => setSelection({ previous: taskIds, current: taskIds })}>选择任务</button>
        : <a className="knowledge-text-button" href="#path/topics">去参考路径添加任务</a>)}
    </div>
    {linked.length > 0 && <ul className="log-task-list">{linked.map(({ id, title, topic }) => {
      const href = topicTaskHref(id);
      return <li key={id}><a href={href} {...workspaceResourceTarget(href)}>{title}</a>
        {topic && <span className="knowledge-muted">{topic}</span>}</li>;
    })}</ul>}
    {selection && <WorkspaceDialog title="选择关联任务" action="保存关联" onClose={() => setSelection(undefined)}
      onSave={() => setLogTasks(log.id, selection.current, selection.previous)}>
      <ReferenceChoices title="学习任务" options={options} selected={selection.current} initiallyOpen
        onChange={(current) => setSelection({ ...selection, current })} />
    </WorkspaceDialog>}
  </section>;
}
