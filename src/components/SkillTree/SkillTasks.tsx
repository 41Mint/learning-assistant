import { useEffect, useState } from 'react';
import type { LearningTask } from '../../types';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import { useTaskStore } from '../../store/taskStore';

interface SkillTasksProps {
  skillId: string;
}

export default function SkillTasks({ skillId }: SkillTasksProps) {
  const { tasks, isLoaded, loadTasks, addTask, updateTask, toggleTask, deleteTask } = useTaskStore();
  const { goal, setCurrentGoal, clearCurrentGoal } = useCurrentGoalStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const skillTasks = tasks.filter((task) => task.parentSkillId === skillId);
  const pendingTasks = skillTasks.filter((task) => !task.completed);
  const completedTasks = skillTasks.filter((task) => task.completed);

  const handleAdd = () => {
    if (!title.trim()) return;
    addTask(skillId, title.trim(), description.trim());
    setTitle('');
    setDescription('');
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

  const handleDelete = (task: LearningTask) => {
    if (!window.confirm(`确定删除任务“${task.title}”吗？此操作无法恢复。`)) return;
    if (goal?.type === 'task' && goal.id === task.id) clearCurrentGoal();
    deleteTask(task.id);
  };

  const renderTask = (task: LearningTask) => {
    const isEditing = editingTaskId === task.id;
    const isCurrentGoal = goal?.type === 'task' && goal.id === task.id;

    return (
      <div key={task.id} className={`rounded-md p-2 ${task.completed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-900'}`}>
        {isEditing ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={editingTitle}
              onChange={(event) => setEditingTitle(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && saveEditing()}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <input
              value={editingDescription}
              onChange={(event) => setEditingDescription(event.target.value)}
              placeholder="补充说明（可选）"
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <button type="button" onClick={saveEditing} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">保存</button>
              <button type="button" onClick={cancelEditing} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200">取消</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => handleToggle(task.id)}
              className="mt-1 h-4 w-4 accent-blue-600"
              aria-label={`完成任务：${task.title}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${task.completed ? 'text-green-800 line-through dark:text-green-300' : 'text-gray-800 dark:text-gray-200'}`}>{task.title}</p>
              {task.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{task.description}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              {!task.completed && (
                <button
                  type="button"
                  onClick={() => setCurrentGoal({ type: 'task', id: task.id, label: task.title })}
                  className={`rounded px-2 py-1 text-xs ${isCurrentGoal ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100' : 'bg-white text-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-200'}`}
                >
                  {isCurrentGoal ? '当前目标' : '设为目标'}
                </button>
              )}
              <button type="button" onClick={() => startEditing(task)} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700">编辑</button>
              <button type="button" onClick={() => handleDelete(task)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30">删除</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">自定义任务 {isLoaded && `· ${completedTasks.length}/${skillTasks.length} 已完成`}</span>
      </div>

      {pendingTasks.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">待完成（{pendingTasks.length}）</p>
          {pendingTasks.map(renderTask)}
        </div>
      )}

      {completedTasks.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-green-700 dark:text-green-300">已完成（{completedTasks.length}）</summary>
          <div className="mt-2 space-y-2">{completedTasks.map(renderTask)}</div>
        </details>
      )}

      <div className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
            placeholder="添加一个可执行任务"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="补充说明（可选）"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <button type="button" onClick={handleAdd} className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500">
            添加任务
          </button>
      </div>
    </div>
  );
}
