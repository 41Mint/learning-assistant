import { useContext, useEffect, useState } from 'react';
import { SKILL_CATEGORIES } from '../../data/skillPath';
import { useSkillTreeStore } from '../../store/skillTreeStore';
import type { TopicFields } from '../../store/skillTreeStore';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import { useTaskStore } from '../../store/taskStore';
import { SKILL_TOPIC_DESCRIPTION_LIMIT, SKILL_TOPIC_NAME_LIMIT } from '../../utils/skillPathStorage';
import { AssistantSlots } from '../Assistant/assistantSlots';
import WorkspaceDialog from '../common/WorkspaceDialog';
import SkillTasks from './SkillTasks';

export default function SkillTree() {
  const { topics, completedIds, isLoaded, error, loadSkillTree, saveTopic, deleteTopic, toggleCompleted } = useSkillTreeStore();
  const { goal, setCurrentGoal } = useCurrentGoalStore();
  const { tasks, loadTasks, isLoaded: tasksLoaded } = useTaskStore();
  const { askAboutGrowth } = useContext(AssistantSlots);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [selection, setSelection] = useState<string>();
  const [editor, setEditor] = useState<{ id?: string; fields: TopicFields }>();
  const [deleting, setDeleting] = useState<string>();

  useEffect(() => { loadSkillTree(); loadTasks(); }, [loadSkillTree, loadTasks]);

  if (!isLoaded) return <p>正在加载参考路径…</p>;
  if (error) return <p role="alert">{error}</p>;

  const selected = topics.find(({ id }) => id === selection) ?? topics[0];
  const topicToDelete = topics.find(({ id }) => id === deleting);
  const taskCount = topicToDelete ? tasks.filter(({ parentSkillId }) => parentSkillId === topicToDelete.id).length : 0;
  const updateEditor = (values: Partial<TopicFields>) => {
    setEditor((current) => current && { ...current, fields: { ...current.fields, ...values } });
  };
  const select = (id: string) => {
    setNotice('');
    setActionError('');
    setSelection(id);
  };

  return (
    <div className="growth-reference-path">
      <div className="growth-reference-heading">
        <h2>参考路径</h2>
        <button type="button" className="note-button" onClick={() => setEditor({
          fields: { name: '', description: '', category: selected?.category ?? '其他', prerequisites: [] },
        })}>添加主题</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {selected ? <div className="growth-topic-layout">
        <nav className="growth-topic-nav" aria-label="参考主题">
          {SKILL_CATEGORIES.map((category) => {
            const items = topics.filter((topic) => topic.category === category.id);
            return items.length > 0 && <div key={category.id}>
              <h3>{category.title}</h3>
              {items.map((topic) => <button key={topic.id} type="button"
                aria-pressed={selected.id === topic.id} onClick={() => select(topic.id)}>{topic.name}
                {completedIds.includes(topic.id) && <span aria-label="已完成">✓</span>}</button>)}
            </div>;
          })}
        </nav>
        <div className="growth-topic-detail">
          {topics.map((topic) => {
            const completed = completedIds.includes(topic.id);
            const related = topics.filter(({ id }) => topic.prerequisites.includes(id)).map(({ name }) => name);
            return (
              <article key={topic.id} className="growth-card growth-topic" hidden={selected.id !== topic.id} aria-label={topic.name}>
                <div className="growth-heading">
                  <h4>{topic.name}</h4>
                  <div className="growth-topic-actions">
                    <button type="button" className="knowledge-text-button" onClick={() => setEditor({ id: topic.id, fields: {
                      name: topic.name, description: topic.description, category: topic.category, prerequisites: topic.prerequisites,
                    } })}>编辑主题</button>
                    <button type="button" className="knowledge-text-button danger" disabled={!tasksLoaded}
                      onClick={() => setDeleting(topic.id)}>删除主题</button>
                  </div>
                </div>
                {topic.description && <p className="growth-topic-description">{topic.description}</p>}
                {related.length > 0 && <p className="growth-muted">可参考 {related.join('、')}</p>}
                {completed && <p className="growth-muted">已标记完成</p>}
                <div className="growth-topic-actions">
                  <button type="button" className="note-button secondary" onClick={() => {
                    try {
                      toggleCompleted(topic.id);
                      setActionError('');
                      setNotice('参考节点记录已保存。');
                    } catch (error) {
                      setNotice('');
                      setActionError(error instanceof Error ? error.message : '保存参考路径失败。');
                    }
                  }}>{completed ? '撤销完成' : '标记完成'}</button>
                  {!completed && <button type="button" className="note-button secondary"
                    onClick={() => setCurrentGoal({ type: 'skill', id: topic.id, label: topic.name })}>
                    {goal?.id === topic.id && goal.type === 'skill' ? '当前目标' : '设为当前目标'}
                  </button>}
                  <button type="button" className="note-button secondary" disabled={!tasksLoaded}
                    onClick={() => askAboutGrowth({ kind: 'topic', id: topic.id })}>询问智能体</button>
                </div>
                <SkillTasks skillId={topic.id} />
              </article>
            );
          })}
        </div>
      </div> : <p>暂无参考主题。</p>}
      {editor && <WorkspaceDialog title={editor.id ? '编辑主题' : '添加主题'} action="保存主题"
        valid={Boolean(editor.fields.name.trim())} onClose={() => setEditor(undefined)}
        onSave={() => {
          const id = saveTopic(editor.fields, editor.id);
          select(id);
          setNotice('主题已保存。');
        }}>
        <label className="growth-field">主题名称<input autoFocus maxLength={SKILL_TOPIC_NAME_LIMIT}
          value={editor.fields.name} onChange={(event) => updateEditor({ name: event.target.value })} /></label>
        <label className="growth-field">领域<select value={editor.fields.category} onChange={(event) => {
          const category = SKILL_CATEGORIES.find(({ id }) => id === event.target.value);
          if (category) updateEditor({ category: category.id });
        }}>{SKILL_CATEGORIES.map(({ id }) => <option key={id} value={id}>{id}</option>)}</select></label>
        <label className="growth-field">主题说明<textarea rows={3} maxLength={SKILL_TOPIC_DESCRIPTION_LIMIT}
          value={editor.fields.description} onChange={(event) => updateEditor({ description: event.target.value })} /></label>
        {topics.some(({ id }) => id !== editor.id) && <details className="growth-topic-references">
          <summary>可参考的主题</summary>
          <div role="group" aria-label="可参考的主题">
            {topics.filter(({ id }) => id !== editor.id).map(({ id, name }) => <label key={id}>
              <input type="checkbox" checked={editor.fields.prerequisites.includes(id)} onChange={(event) => {
                const refs = editor.fields.prerequisites;
                updateEditor({ prerequisites: event.target.checked ? [...refs, id] : refs.filter((ref) => ref !== id) });
              }} />
              {name}
            </label>)}
          </div>
        </details>}
      </WorkspaceDialog>}
      {topicToDelete && <WorkspaceDialog title="删除主题" action="确认删除" destructive
        onClose={() => setDeleting(undefined)} onSave={() => {
          deleteTopic(topicToDelete.id);
          setNotice('已删除主题。');
          setActionError('');
        }}>
        <p>删除「{topicToDelete.name}」{taskCount ? `及其下的 ${taskCount} 项任务` : ''}？此操作无法撤销。</p>
        <p>此主题的完成标记及其他主题对它的引用也会移除。若当前学习目标属于此主题，将一并清除。</p>
      </WorkspaceDialog>}
    </div>
  );
}
