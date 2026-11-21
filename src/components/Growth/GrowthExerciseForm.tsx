import { useState } from 'react';
import { useGrowthStore } from '../../store/growthStore';
import type { SavedExercise } from '../../types';
import { withGrowthDomain } from '../../utils/growthDomains';
import { ADD_EXERCISE_LABEL, PRACTICE_VERIFICATION_LABEL } from '../../utils/growthLabels';
import FocusEditor from '../common/FocusEditor';
import GrowthDomainFields from './GrowthDomainFields';

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
  const [customDomain, setCustomDomain] = useState('');
  const [error, setError] = useState('');
  const save = useGrowthStore((state) => state.editExercise);

  return <FocusEditor title={creating ? ADD_EXERCISE_LABEL : '编辑练习卡片'} formLabel="练习卡片表单"
    description="记下想试的点子或练习，做过以后可以记录实践。" saveLabel="保存卡片" cancelLabel="取消" error={error}
    onCancel={onCancel} onSave={() => {
      try {
        save({ ...draft, title: draft.title.trim(), action: draft.action.trim(), done: draft.done.trim(),
          domains: withGrowthDomain(draft.domains, customDomain) }, groupId);
        onSaved();
      } catch (error) {
        setError(error instanceof Error ? error.message : '保存卡片失败，请重试。');
      }
    }}>
    <label className="growth-field">卡片名称<input required maxLength={100} value={draft.title}
      onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
    <GrowthDomainFields domains={draft.domains} onChange={(domains) => setDraft({ ...draft, domains })}
      customName={customDomain} onCustomNameChange={setCustomDomain} />
    <label className="growth-field">卡片说明（可选）<textarea rows={4} maxLength={1200} value={draft.action}
      onChange={(event) => setDraft({ ...draft, action: event.target.value })} /></label>
    <label className="growth-field">{PRACTICE_VERIFICATION_LABEL}（可选）<textarea rows={3} maxLength={1200} value={draft.done}
      onChange={(event) => setDraft({ ...draft, done: event.target.value })} /></label>
  </FocusEditor>;
}
