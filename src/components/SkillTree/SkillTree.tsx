import { useEffect, useMemo, useState } from 'react';
import { SKILL_CATEGORIES, SKILL_PATH, getSkillNode } from '../../data/skillPath';
import { useSkillTreeStore } from '../../store/skillTreeStore';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import SkillTasks from './SkillTasks';

export default function SkillTree() {
  const { completedIds, isLoaded, loadSkillTree, isUnlocked, toggleCompleted } = useSkillTreeStore();
  const [notice, setNotice] = useState('');
  const { goal: currentGoal, loadCurrentGoal, setCurrentGoal, clearCurrentGoal } = useCurrentGoalStore();

  useEffect(() => {
    loadSkillTree();
  }, [loadSkillTree]);

  useEffect(() => {
    loadCurrentGoal();
  }, [loadCurrentGoal]);

  const nextNodes = useMemo(
    () => SKILL_PATH.filter((node) => !completedIds.includes(node.id) && isUnlocked(node.id)).slice(0, 3),
    [completedIds, isUnlocked],
  );

  const handleToggle = (id: string) => {
    const result = toggleCompleted(id);
    if (result.changed && completedIds.includes(id) && currentGoal?.type === 'skill' && currentGoal.id === id) {
      clearCurrentGoal();
    }
    setNotice(result.reason || '学习进度已保存。');
  };

  const handleSetCurrentGoal = (id: string) => {
    const node = getSkillNode(id);
    if (!node) return;
    setCurrentGoal({ type: 'skill', id, label: node.name });
    setNotice('已设为当前学习目标；完成番茄钟时会自动关联到今日学习日志。');
  };

  if (!isLoaded) {
    return <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">加载学习路径中...</div>;
  }

  const progress = Math.round((completedIds.length / SKILL_PATH.length) * 100);

  return (
    <div className="module-card skill-tree-card bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🗺️ 游戏开发学习路径</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            先建立 Unity 客户端基础，再按兴趣探索图形学与引擎工具。
          </p>
        </div>
        <div className="min-w-32 text-left sm:text-right">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{completedIds.length}/{SKILL_PATH.length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">已完成 · {progress}%</div>
        </div>
      </div>

      <div className="h-2 mb-6 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100">下一步建议</h3>
        {nextNodes.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {nextNodes.map((node) => (
              <span key={node.id} className="rounded-full bg-white px-3 py-1 text-sm text-blue-800 shadow-sm dark:bg-gray-800 dark:text-blue-200">
                {node.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">所有节点均已完成，下一版可以加入你的自定义目标。</p>
        )}
      </div>

      {notice && <p className="mb-4 text-sm text-gray-600 dark:text-gray-300" role="status">{notice}</p>}

      <div className="space-y-6">
        {SKILL_CATEGORIES.map((category) => {
          const nodes = SKILL_PATH.filter((node) => node.category === category.id);
          return (
            <section key={category.id}>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{category.title}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {nodes.map((node) => {
                  const isCompleted = completedIds.includes(node.id);
                  const unlocked = isUnlocked(node.id);
                  const prerequisites = node.prerequisites.map((id) => getSkillNode(id)?.name).filter(Boolean);
                  const isLocked = !isCompleted && !unlocked;

                  return (
                    <article
                      key={node.id}
                      className={`rounded-lg border p-4 ${isCompleted ? 'border-green-200 bg-green-50 dark:border-green-900/60 dark:bg-green-900/20' : isLocked ? 'border-gray-200 bg-gray-50 opacity-75 dark:border-gray-700 dark:bg-gray-900' : 'border-blue-200 bg-white dark:border-blue-900/60 dark:bg-gray-800'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{node.name}</h4>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{node.description}</p>
                        </div>
                        <span className="shrink-0 text-lg" aria-label={isCompleted ? '已完成' : isLocked ? '未解锁' : '可开始'}>
                          {isCompleted ? '✓' : isLocked ? '🔒' : '▶'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>预计 {node.estimatedTime} 小时</span>
                        {isLocked && <span>前置：{prerequisites.join('、')}</span>}
                      </div>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleToggle(node.id)}
                        className={`mt-4 rounded-md px-3 py-2 text-sm font-medium transition ${isCompleted ? 'bg-green-600 text-white hover:bg-green-700' : isLocked ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      >
                        {isCompleted ? '撤销完成' : isLocked ? '等待解锁' : '标记完成'}
                      </button>
                      {!isCompleted && !isLocked && (
                        <button
                          type="button"
                          onClick={() => handleSetCurrentGoal(node.id)}
                          className={`mt-4 ml-2 rounded-md px-3 py-2 text-sm font-medium transition ${currentGoal?.type === 'skill' && currentGoal.id === node.id ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}`}
                        >
                          {currentGoal?.type === 'skill' && currentGoal.id === node.id ? '当前目标' : '设为当前目标'}
                        </button>
                      )}
                      <SkillTasks skillId={node.id} unlocked={unlocked || isCompleted} />
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
