import { useEffect, useId, useRef, useState } from 'react';
import type { LearningTask } from '../../types';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import { useTaskStore } from '../../store/taskStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { workspaceResourceTarget } from '../../store/workspaceStore';
import { logLabel } from '../../utils/growth';
import InlineReveal from '../common/InlineReveal';
import TaskFields from './TaskFields';
import WorkspaceDialog from '../common/WorkspaceDialog';

interface SkillTasksProps {
  skillId: string;
  focusedTaskId?: string;
}

export default function SkillTasks({ skillId, focusedTaskId }: SkillTasksProps) {
  const { tasks, isLoaded, addTask, updateTask, toggleTask, deleteTask } = useTaskStore();
  const { goal, setCurrentGoal, clearCurrentGoal } = useCurrentGoalStore();
  const logs = useStudyLogStore((state) => state.logs);
  const focusedTask = useRef<HTMLLIElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const addFormId = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string>();

  const skillTasks = tasks.filter((task) => task.parentSkillId === skillId);
  const pendingTasks = skillTasks.filter((task) => !task.completed);
  const completedTasks = skillTasks.filter((task) => task.completed);
  const deleting = skillTasks.find(({ id }) => id === deletingId);
  const hasCompletedFocus = completedTasks.some(({ id }) => id === focusedTaskId);
  useEffect(() => {
    if (!focusedTaskId) return;
    const frame = window.requestAnimationFrame(() => {
      const item = focusedTask.current;
      if (item?.getClientRects().length) {
        item.focus({ preventScroll: true });
        item.scrollIntoView({ block: 'nearest' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedTaskId, hasCompletedFocus]);

  const handleAdd = () => {
    if (!title.trim()) return;
    try {
      addTask(skillId, title.trim(), description.trim());
    } catch (error) {
      setAddError(error instanceof Error ? error.message : '保存任务失败，请重试。');
      return;
    }
    setAddError('');
    setTitle('');
    setDescription('');
    setAdding(false);
  };

  const handleToggle = (taskId: string) => {
    if (goal?.type === 'task' && goal.id === taskId) clearCurrentGoal();
    toggleTask(taskId);
  };

  const saveEditing = (id: string, title: string, description: string) => {
    updateTask(id, title, description);
    if (goal?.type === 'task' && goal.id === id) {
      setCurrentGoal({ type: 'task', id, label: title });
    }
    setEditingTaskId(null);
  };

  const renderTask = (task: LearningTask) => {
    const currentGoal = goal?.type === 'task' && goal.id === task.id;
    const related = logs.filter((log) => log.taskIds?.includes(task.id)).sort((a, b) => b.date.localeCompare(a.date));
    const focused = focusedTaskId === task.id;
    const editing = editingTaskId === task.id;
    const editFormId = `${addFormId}-edit-${task.id}`;
    return <li key={task.id} className="topic-task" data-completed={task.completed || undefined}
      ref={focused ? focusedTask : undefined} tabIndex={focused ? -1 : undefined} data-task-focus={focused || undefined}>
      <input type="checkbox" className="topic-task-check" checked={task.completed} disabled={editing}
        onChange={() => handleToggle(task.id)} aria-label={`完成任务：${task.title}`} />
      <div className="topic-task-content">
        <p className="topic-task-title">{task.title}</p>
        {task.description && <p className="topic-task-description">{task.description}</p>}
        {related.length > 0 && <details className="topic-task-logs">
          <summary>学习日志（{related.length}）</summary>
          <ul>{related.map((log) => {
            const href = `#history/${log.date}`;
            return <li key={log.id}><a href={href} {...workspaceResourceTarget(href)}>{logLabel(log)}</a></li>;
          })}</ul>
        </details>}
      </div>
      <div className="topic-task-actions">
        {!task.completed && <button type="button" className="workspace-button" data-active={currentGoal || undefined} disabled={editing}
          onClick={() => setCurrentGoal({ type: 'task', id: task.id, label: task.title })}>{currentGoal ? '当前目标' : '设为目标'}</button>}
        <button type="button" className="workspace-button" aria-expanded={editing} aria-controls={editing ? editFormId : undefined}
          disabled={editing} onClick={(event) => { editTrigger.current = event.currentTarget; setEditingTaskId(task.id); }}>编辑</button>
        <button type="button" className="workspace-button" data-danger disabled={editing} onClick={() => setDeletingId(task.id)}>删除</button>
      </div>
      <InlineReveal id={editFormId} open={editing} trigger={editingTaskId === null ? editTrigger : undefined}>
        <EditTaskForm task={task} onSave={(title, description) => saveEditing(task.id, title, description)}
          onCancel={() => setEditingTaskId(null)} />
      </InlineReveal>
    </li>;
  };

  return (
    <div className="growth-task-list">
      <div className="growth-heading">
        <strong>自定义任务 <small>{isLoaded && `${completedTasks.length}/${skillTasks.length} 已完成`}</small></strong>
        <button ref={addTrigger} type="button" className="workspace-button" aria-expanded={adding} aria-controls={adding ? addFormId : undefined}
          disabled={!isLoaded || adding} onClick={() => setAdding(true)}>添加任务</button>
      </div>

      {pendingTasks.length > 0 && <div className="topic-task-section">
        <p>待完成（{pendingTasks.length}）</p>
        <ul className="topic-task-items">{pendingTasks.map(renderTask)}</ul>
      </div>}
      {completedTasks.length > 0 && <details className="topic-task-section" open={hasCompletedFocus || undefined}>
        <summary>已完成（{completedTasks.length}）</summary>
        <ul className="topic-task-items">{completedTasks.map(renderTask)}</ul>
      </details>}

      <InlineReveal id={addFormId} open={adding} trigger={addTrigger}>
        <form className="growth-task-form" aria-label="添加任务" data-preserves-on-navigation onSubmit={(event) => { event.preventDefault(); handleAdd(); }}>
          <TaskFields title={title} description={description} onTitle={setTitle} onDescription={setDescription} />
          {addError && <p role="alert">{addError}</p>}
          <div className="code-actions">
            <button type="submit" className="note-button" disabled={!title.trim()}>保存任务</button>
            <button type="button" className="workspace-button" onClick={() => { setAdding(false); setAddError(''); }}>取消</button>
          </div>
        </form>
      </InlineReveal>

      {deleting && <WorkspaceDialog title="删除任务" action="确认删除" destructive
        onClose={() => setDeletingId(undefined)} onSave={() => deleteTask(deleting.id)}>
        <p>删除「{deleting.title}」？此操作无法恢复。</p>
        <p>关联的学习日志会保留，任务关联会解除。</p>
        {goal?.type === 'task' && goal.id === deleting.id && <p>这项任务是当前学习目标，删除时会同时清除该目标。</p>}
      </WorkspaceDialog>}
    </div>
  );
}

function EditTaskForm({ task, onSave, onCancel }: {
  task: LearningTask;
  onSave: (title: string, description: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  return <form className="growth-task-form" aria-label="编辑任务" data-preserves-on-navigation onSubmit={(event) => {
    event.preventDefault();
    if (title.trim()) onSave(title.trim(), description.trim());
  }}>
    <TaskFields title={title} description={description} onTitle={setTitle} onDescription={setDescription} />
    <div className="code-actions">
      <button type="submit" className="note-button" disabled={!title.trim()}>保存</button>
      <button type="button" className="workspace-button" onClick={onCancel}>取消</button>
    </div>
  </form>;
}
