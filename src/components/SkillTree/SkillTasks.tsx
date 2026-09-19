import { useEffect, useState } from 'react';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import { useTaskStore } from '../../store/taskStore';

interface SkillTasksProps {
  skillId: string;
  unlocked: boolean;
}

export default function SkillTasks({ skillId, unlocked }: SkillTasksProps) {
  const { tasks, isLoaded, loadTasks, addTask, toggleTask } = useTaskStore();
  const { goal, setCurrentGoal, clearCurrentGoal } = useCurrentGoalStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const skillTasks = tasks.filter((task) => task.parentSkillId === skillId);
  const completedCount = skillTasks.filter((task) => task.completed).length;

  const handleAdd = () => {
    if (!title.trim()) return;
    addTask(skillId, title.trim(), description.trim());
    setTitle('');
    setDescription('');
  };

  const handleToggle = (taskId: string) => {
    if (goal?.type === 'task' && goal.id === taskId) {
      clearCurrentGoal();
    }
    toggleTask(taskId);
  };

  return (
    <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">自定义任务 {isLoaded && `(${completedCount}/${skillTasks.length})`}</span>
      </div>

      {skillTasks.length > 0 && (
        <div className="mt-2 space-y-2">
          {skillTasks.map((task) => (
            <div key={task.id} className="rounded-md bg-gray-50 p-2 dark:bg-gray-900">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggle(task.id)}
                  className="mt-1 h-4 w-4 accent-blue-600"
                  aria-label={`完成任务：${task.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>{task.title}</p>
                  {task.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{task.description}</p>}
                </div>
                {!task.completed && (
                  <button
                    type="button"
                    onClick={() => setCurrentGoal({ type: 'task', id: task.id, label: task.title })}
                    className={`shrink-0 rounded px-2 py-1 text-xs ${goal?.type === 'task' && goal.id === task.id ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100' : 'bg-white text-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-200'}`}
                  >
                    {goal?.type === 'task' && goal.id === task.id ? '当前目标' : '设为目标'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {unlocked ? (
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
      ) : (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">解锁该节点后可创建关联任务。</p>
      )}
    </div>
  );
}
