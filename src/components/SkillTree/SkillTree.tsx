import { useEffect, useState } from 'react';
import { SKILL_CATEGORIES, SKILL_PATH, getSkillNode } from '../../data/skillPath';
import { useSkillTreeStore } from '../../store/skillTreeStore';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import SkillTasks from './SkillTasks';

export default function SkillTree() {
  const { completedIds, isLoaded, loadSkillTree, toggleCompleted } = useSkillTreeStore();
  const { goal, setCurrentGoal, clearCurrentGoal } = useCurrentGoalStore();
  const [notice, setNotice] = useState('');

  useEffect(() => { loadSkillTree(); }, [loadSkillTree]);

  const handleToggle = (id: string) => {
    const result = toggleCompleted(id);
    if (result.changed && !completedIds.includes(id) && goal?.type === 'skill' && goal.id === id) {
      clearCurrentGoal();
    }
    setNotice(result.reason || '参考节点记录已保存。');
  };

  if (!isLoaded) return <p>正在加载参考路径…</p>;

  return (
    <div className="growth-reference-path">
      <p className="growth-muted">可以按需要浏览主题、安排任务或设置当前目标。原有完成记录显示在对应主题中。</p>
      {notice && <p role="status">{notice}</p>}
      {SKILL_CATEGORIES.map((category) => (
        <section key={category.id}>
          <h3>{category.title}</h3>
          <div className="growth-preset-grid">
            {SKILL_PATH.filter((node) => node.category === category.id).map((node) => {
              const completed = completedIds.includes(node.id);
              const related = node.prerequisites.map((id) => getSkillNode(id)?.name).filter(Boolean);
              return (
                <article key={node.id} className="growth-card" aria-label={node.name}>
                  <h4>{node.name}</h4>
                  <p>{node.description}</p>
                  {related.length > 0 && <p className="growth-muted">可参考 {related.join('、')}</p>}
                  {completed && <p className="growth-muted">已标记完成</p>}
                  <button type="button" className="note-button secondary" onClick={() => handleToggle(node.id)}>
                    {completed ? '撤销完成' : '标记完成'}
                  </button>
                  {!completed && (
                    <button type="button" className="note-button secondary"
                      onClick={() => setCurrentGoal({ type: 'skill', id: node.id, label: node.name })}>
                      {goal?.id === node.id && goal.type === 'skill' ? '当前目标' : '设为当前目标'}
                    </button>
                  )}
                  <SkillTasks skillId={node.id} />
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
