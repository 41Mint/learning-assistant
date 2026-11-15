import { useState } from 'react';
import { useGrowthStore } from '../../store/growthStore';
import { growthExercises } from '../../utils/growth';
import { normalizedName } from '../../utils/knowledge';
import WorkspaceDialog from '../common/WorkspaceDialog';

export interface ProposedGrowthGroup {
  name: string;
  reason: string;
  cards: { id: string; title: string }[];
}

export default function GrowthGroupingPlan({ suggestions }: { suggestions: ProposedGrowthGroup[] }) {
  const growth = useGrowthStore();
  const [names, setNames] = useState(() => suggestions.map(({ name }) => name));
  const [review, setReview] = useState<{ index: number; name: string }>();
  const groupsByName = new Map(growth.groups.map((group) => [normalizedName(group.name), group]));
  const owners = new Map(growth.groups.flatMap((group) => group.cardIds.map((id) => [id, group] as const)));
  const currentTitles = new Map([...growthExercises(growth), ...growth.outcomes].map(({ id, title }) => [id, title]));
  const target = review && groupsByName.get(normalizedName(review.name));
  const canApply = (cards: ProposedGrowthGroup['cards']) => growth.isLoaded && !growth.error && cards.every(({ id }) => currentTitles.has(id));
  const list = (cards: ProposedGrowthGroup['cards']) => <ul className="assistant-grouping-members">{cards.map(({ id, title }) => {
    const current = currentTitles.get(id);
    const owner = owners.get(id);
    return <li key={id}>{current ?? title} <span className="growth-muted">· {current ? owner?.name ?? '未分组' : '卡片已不可用'}</span></li>;
  })}</ul>;

  return <section className="assistant-grouping" aria-label="分组建议">
    {suggestions.map(({ name, reason, cards }, index) => {
      const existing = groupsByName.get(normalizedName(names[index]));
      const inGroup = existing && cards.every(({ id }) => owners.get(id)?.id === existing.id && currentTitles.has(id));
      const label = existing?.name ?? names[index];
      return <article className="growth-card assistant-grouping-card" aria-label={label} key={name}>
        <h4>{label}</h4>
        <p className="growth-muted">{inGroup ? '已在此卡组' : existing ? '加入已有卡组' : '新建卡组'}</p>
        {reason && <p>{reason}</p>}
        {list(cards)}
        <button type="button" className="note-button secondary" disabled={Boolean(inGroup) || !canApply(cards)}
          onClick={() => setReview({ index, name: label })}>应用这组</button>
      </article>;
    })}
    {review && <WorkspaceDialog title="应用分组建议" action="确认应用"
      valid={Boolean(review.name.trim()) && canApply(suggestions[review.index].cards)} onClose={() => setReview(undefined)} onSave={() => {
        growth.applyGrouping(review.name, suggestions[review.index].cards.map(({ id }) => id));
        setNames((previous) => previous.map((name, index) => index === review.index ? review.name.trim() : name));
      }}>
      <label className="growth-field">目标卡组名称<input autoFocus maxLength={60} value={review.name}
        onChange={(event) => setReview({ ...review, name: event.target.value })} /></label>
      <p>{target ? `将下列卡片移到已有卡组「${target.name}」。` : '创建卡组并移入下列卡片。'}</p>
      {list(suggestions[review.index].cards)}
    </WorkspaceDialog>}
  </section>;
}
