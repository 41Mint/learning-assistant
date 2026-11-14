import { useState } from 'react';
import { GROWTH_DOMAINS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import type { SavedExercise } from '../../types';
import FocusEditor from '../common/FocusEditor';

export interface GrowthExerciseDraft {
  exercise: SavedExercise;
  creating: boolean;
  groupId?: string;
}

export default function GrowthExerciseForm({ exercise, creating, groupId, onSaved, onCancel }: {
  onSaved: () => void;
  onCancel: () => void;
} & GrowthExerciseDraft) {
  const [draft, setDraft] = useState(exercise);
  const [error, setError] = useState('');
  const save = useGrowthStore((state) => state.editExercise);

  return <FocusEditor title={creating ? '添加待尝试' : '编辑待尝试卡片'} formLabel="待尝试卡片表单"
    description="记下想做的事，完成后可以记录实践。" saveLabel="保存卡片" cancelLabel="取消" error={error}
    onCancel={onCancel} onSave={() => {
      try {
        save({ ...draft, title: draft.title.trim(), action: draft.action.trim(), done: draft.done.trim() }, groupId);
        onSaved();
      } catch (error) {
        setError(error instanceof Error ? error.message : '保存卡片失败，请重试。');
      }
    }}>
    <label className="growth-field">卡片名称<input required maxLength={100} value={draft.title}
      onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
    <fieldset className="growth-domains">
      <legend>领域（可选）</legend>
      {GROWTH_DOMAINS.map((domain) => <label key={domain}>
        <input type="checkbox" checked={draft.domains.includes(domain)} onChange={(event) => setDraft({
          ...draft, domains: event.target.checked ? [...draft.domains, domain] : draft.domains.filter((item) => item !== domain),
        })} />{domain}
      </label>)}
    </fieldset>
    <label className="growth-field">卡片说明（可选）<textarea rows={4} maxLength={1200} value={draft.action}
      onChange={(event) => setDraft({ ...draft, action: event.target.value })} /></label>
    <label className="growth-field">完成条件（可选）<textarea rows={3} maxLength={1200} value={draft.done}
      onChange={(event) => setDraft({ ...draft, done: event.target.value })} /></label>
  </FocusEditor>;
}
