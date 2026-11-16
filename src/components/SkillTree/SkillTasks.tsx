import { useState } from 'react';
import type { LearningTask } from '../../types';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import { useTaskStore } from '../../store/taskStore';
import TaskFields from './TaskFields';
import WorkspaceDialog from '../common/WorkspaceDialog';

interface SkillTasksProps {
  skillId: string;
}

export default function SkillTasks({ skillId }: SkillTasksProps) {
  const { tasks, isLoaded, addTask, updateTask, toggleTask, deleteTask } = useTaskStore();
  const { goal, setCurrentGoal, clearCurrentGoal } = useCurrentGoalStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [deletingId, setDeletingId] = useState<string>();

  const skillTasks = tasks.filter((task) => task.parentSkillId === skillId);
  const pendingTasks = skillTasks.filter((task) => !task.completed);
  const completedTasks = skillTasks.filter((task) => task.completed);
  const deleting = skillTasks.find(({ id }) => id === deletingId);

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

  const startEditing = (task: LearningTask) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setEditingDescription(task.description);
  };

  const saveEditing = () => {
    if (!editingTaskId || !editingTitle.trim()) return;
    updateTask(editingTaskId, editingTitle.trim(), editingDescription.trim());
    if (goal?.type === 'task' && goal.id === editingTaskId) {
      setCurrentGoal({ type: 'task', id: editingTaskId, label: editingTitle.trim() });
    }
    setEditingTaskId(null);
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingTitle('');
    setEditingDescription('');
  };

  const renderTask = (task: LearningTask) => {
    const currentGoal = goal?.type === 'task' && goal.id === task.id;
    return <li key={task.id} className="topic-task" data-completed={task.completed || undefined}>
      {editingTaskId === task.id ? (
        <form className="growth-task-form topic-task-editor" data-preserves-on-navigation onSubmit={(event) => {
          event.preventDefault();
          saveEditing();
        }}>
          <TaskFields title={editingTitle} description={editingDescription} onTitle={setEditingTitle} onDescription={setEditingDescription} />
          <div className="code-actions">
            <button type="submit" className="note-button" disabled={!editingTitle.trim()}>保存</button>
            <button type="button" className="workspace-button" onClick={cancelEditing}>取消</button>
          </div>
        </form>
      ) : (
        <>
          <input type="checkbox" className="topic-task-check" checked={task.completed} onChange={() => handleToggle(task.id)}
            aria-label={`完成任务：${task.title}`} />
          <div className="topic-task-content">
            <p className="topic-task-title">{task.title}</p>
            {task.description && <p className="topic-task-description">{task.description}</p>}
          </div>
          <div className="topic-task-actions">
            {!task.completed && <button type="button" className="workspace-button" data-active={currentGoal || undefined}
              onClick={() => setCurrentGoal({ type: 'task', id: task.id, label: task.title })}>{currentGoal ? '当前目标' : '设为目标'}</button>}
            <button type="button" className="workspace-button" onClick={() => startEditing(task)}>编辑</button>
            <button type="button" className="workspace-button" data-danger onClick={() => setDeletingId(task.id)}>删除</button>
          </div>
        </>
      )}
    </li>;
  };

  return (
    <div className="growth-task-list">
      <div className="growth-heading">
        <strong>自定义任务 <small>{isLoaded && `${completedTasks.length}/${skillTasks.length} 已完成`}</small></strong>
        {!adding && <button type="button" className="workspace-button" onClick={() => setAdding(true)}>添加任务</button>}
      </div>

      {pendingTasks.length > 0 && <div className="topic-task-section">
        <p>待完成（{pendingTasks.length}）</p>
        <ul className="topic-task-items">{pendingTasks.map(renderTask)}</ul>
      </div>}
      {completedTasks.length > 0 && <details className="topic-task-section">
        <summary>已完成（{completedTasks.length}）</summary>
        <ul className="topic-task-items">{completedTasks.map(renderTask)}</ul>
      </details>}

      {adding && <form className="growth-task-form" data-preserves-on-navigation onSubmit={(event) => { event.preventDefault(); handleAdd(); }}>
        <TaskFields title={title} description={description} onTitle={setTitle} onDescription={setDescription} />
        {addError && <p role="alert">{addError}</p>}
        <div className="code-actions">
          <button type="submit" className="note-button" disabled={!title.trim()}>保存任务</button>
          <button type="button" className="workspace-button" onClick={() => { setAdding(false); setAddError(''); }}>取消</button>
        </div>
      </form>}

      {deleting && <WorkspaceDialog title="删除任务" action="确认删除" destructive
        onClose={() => setDeletingId(undefined)} onSave={() => deleteTask(deleting.id)}>
        <p>删除「{deleting.title}」？此操作无法恢复。</p>
        {goal?.type === 'task' && goal.id === deleting.id && <p>这项任务是当前学习目标，删除时会同时清除该目标。</p>}
      </WorkspaceDialog>}
    </div>
  );
}
