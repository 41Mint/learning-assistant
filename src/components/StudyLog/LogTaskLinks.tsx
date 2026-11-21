import { useId, useRef, useState } from 'react';
import type { SkillNodeDefinition } from '../../data/skillPath';
import type { StudyLog } from '../../types';
import { useStudyLogStore } from '../../store/studyLogStore';
import { useTaskStore } from '../../store/taskStore';
import type { TaskDraft } from '../../store/taskStore';
import { useSkillTreeStore } from '../../store/skillTreeStore';
import { topicTaskHref, workspaceResourceTarget } from '../../store/workspaceStore';
import InlineReveal from '../common/InlineReveal';
import { ReferenceOptions } from '../common/ReferenceChoices';
import SearchableSelect from '../common/SearchableSelect';
import TaskFields from '../SkillTree/TaskFields';

export default function LogTaskLinks({ log }: { log: StudyLog }) {
  const { tasks, isLoaded } = useTaskStore();
  const topics = useSkillTreeStore((state) => state.topics);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const taskIds = log.taskIds ?? [];
  const options = tasks.map(({ id, title, description, parentSkillId, completed }) => {
    const topic = topics.find((topic) => topic.id === parentSkillId)?.name;
    return { id, title, topic, label: [title, topic, completed ? '已完成' : ''].filter(Boolean).join(' · '), fields: [description] };
  });
  const linked = taskIds.flatMap((id) => options.find((task) => task.id === id) ?? []);

  return <section className="log-task-links" aria-label="关联任务">
    <div className="log-task-heading">
      <h3>关联任务{linked.length > 0 ? `（${linked.length}）` : ''}</h3>
      {isLoaded && <button ref={trigger} type="button" className="workspace-button" aria-expanded={open}
        aria-controls={open ? panelId : undefined} onClick={() => setOpen(!open)}>{open ? '收起任务' : '选择任务'}</button>}
    </div>
    {linked.length > 0 && <ul className="log-task-list">{linked.map(({ id, title, topic }) => {
      const href = topicTaskHref(id);
      return <li key={id}><a href={href} {...workspaceResourceTarget(href)}>{title}</a>
        {topic && <span className="knowledge-muted">{topic}</span>}</li>;
    })}</ul>}
    <InlineReveal id={panelId} open={open} trigger={trigger}>
      <LogTaskSelection log={log} topics={topics} options={options} onClose={() => setOpen(false)} />
    </InlineReveal>
  </section>;
}

function LogTaskSelection({ log, topics, options, onClose }: {
  log: StudyLog;
  topics: SkillNodeDefinition[];
  options: { id: string; label: string; fields: string[] }[];
  onClose: () => void;
}) {
  const setLogTasks = useStudyLogStore((state) => state.setLogTasks);
  const addTaskToLog = useTaskStore((state) => state.addTaskToLog);
  const [previous] = useState(() => log.taskIds ?? []);
  const [selected, setSelected] = useState(previous);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const addTrigger = useRef<HTMLButtonElement>(null);
  const addFormId = useId();

  const save = (task?: TaskDraft) => {
    try {
      if (task) addTaskToLog(task, log.id, selected, previous);
      else setLogTasks(log.id, selected, previous);
      onClose();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '保存关联失败，请重试。');
    }
  };
  const closeForm = () => {
    setAdding(false);
    setError('');
  };

  return <section className="log-task-panel" aria-label="选择关联任务" onKeyDown={(event) => {
    if (event.key !== 'Escape' || event.nativeEvent.isComposing || event.defaultPrevented) return;
    event.stopPropagation();
    event.preventDefault();
    if (adding) closeForm();
    else onClose();
  }}>
    <div className="reference-choices">
      <ReferenceOptions title="学习任务" options={options} selected={selected} emptyText="暂无学习任务。" onChange={setSelected} />
    </div>
    <div className="code-actions detail-actions">
      {topics.length > 0 ? <button ref={addTrigger} type="button" className="workspace-button" aria-expanded={adding}
        aria-controls={adding ? addFormId : undefined} disabled={adding}
        onClick={() => { setError(''); setAdding(true); }}>添加任务</button>
        : <a className="knowledge-text-button" href="#path/topics">去参考路径添加主题</a>}
      <button type="button" className="note-button" disabled={adding} onClick={() => save()}>保存关联</button>
      <button type="button" className="workspace-button" onClick={onClose}>取消</button>
    </div>
    <InlineReveal id={addFormId} open={adding} trigger={addTrigger}>
      <NewLogTask topics={topics} onSave={save} onCancel={closeForm} />
    </InlineReveal>
    {error && <p role="alert">{error}</p>}
  </section>;
}

function NewLogTask({ topics, onSave, onCancel }: {
  topics: SkillNodeDefinition[];
  onSave: (task: TaskDraft) => void;
  onCancel: () => void;
}) {
  const [parentSkillId, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const valid = title.trim() && topics.some(({ id }) => id === parentSkillId);
  return <form className="growth-task-form" aria-label="新建关联任务" data-preserves-on-navigation onSubmit={(event) => {
    event.preventDefault();
    if (valid) onSave({ parentSkillId, title, description });
  }}>
    <div className="growth-field">
      <SearchableSelect label="所属主题" placeholder="搜索或选择主题" value={parentSkillId} onChange={setTopic}
        options={topics.map(({ id, name, category, description }) => ({ id, label: name, fields: [category, description] }))} />
    </div>
    <TaskFields title={title} description={description} onTitle={setTitle} onDescription={setDescription} />
    <div className="code-actions detail-actions">
      <button type="submit" className="note-button" disabled={!valid}>保存任务并关联</button>
      <button type="button" className="workspace-button" onClick={onCancel}>取消新建</button>
    </div>
  </form>;
}
