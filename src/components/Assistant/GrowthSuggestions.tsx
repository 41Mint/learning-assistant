import { useEffect, useRef, useState } from 'react';
import { GROWTH_DOMAINS } from '../../data/growthPresets';
import { useGrowthStore } from '../../store/growthStore';
import { workspaceResourceTarget } from '../../store/workspaceStore';
import type { GrowthDomain, SavedExercise } from '../../types';
import { normalizedName } from '../../utils/knowledge';
import { growthExercises } from '../../utils/growth';
import { PRACTICE_IDEAS_LABEL, PRACTICE_VERIFICATION_LABEL } from '../../utils/growthLabels';
import { suggestGrowth } from '../../utils/growthSuggestions';
import GrowthCard from '../Growth/GrowthCard';

const sourceLabels = { log: '日志', entry: '词条', code: '代码' };

export default function GrowthSuggestions({ domain, onDomain, onRecord, onNavigate, recordDisabledReason }: {
  domain: GrowthDomain | '';
  onDomain: (domain: GrowthDomain | '') => void;
  onRecord: (item: SavedExercise) => void;
  onNavigate: () => void;
  recordDisabledReason?: string;
}) {
  const [focus, setFocus] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof suggestGrowth>>>();
  const [resultDomain, setResultDomain] = useState<GrowthDomain | ''>('');
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ text: string; error?: boolean }>();
  const { outcomes, exercises, hiddenPresetIds, saveExercise } = useGrowthStore();
  const knownCards = [...outcomes, ...growthExercises({ exercises, hiddenPresetIds })];
  const controller = useRef<AbortController | null>(null);
  const currentResult = resultDomain === domain ? result : undefined;
  useEffect(() => () => controller.current?.abort(), []);

  const generate = async () => {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setRunning(true);
    setError('');
    setSaveMessage(undefined);
    try {
      const next = await suggestGrowth([domain, focus.trim()].filter(Boolean).join(' ').slice(0, 200), currentResult?.suggestions.map((item) => item.title) ?? [], request.signal);
      if (!request.signal.aborted) { setResult(next); setResultDomain(domain); }
    } catch (error) {
      if (!request.signal.aborted) setError(error instanceof Error ? error.message : '暂时无法生成练习建议，请重试。');
    } finally {
      if (controller.current === request) { controller.current = null; setRunning(false); }
    }
  };

  return <section className="assistant-growth-suggestions" aria-label="练习推荐">
    <form className="growth-recommend-form" data-preserves-on-navigation onSubmit={(event) => { event.preventDefault(); void generate(); }}>
      <label className="growth-field">练习领域
        <select value={domain} disabled={running} onChange={(event) => { onDomain(event.target.value as GrowthDomain | ''); setError(''); }}>
          <option value="">全部领域</option>
          {GROWTH_DOMAINS.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="growth-field">练习偏好（可选）
        <input maxLength={180} value={focus} disabled={running} onChange={(event) => setFocus(event.target.value)} placeholder="例如：只练 C#，不用打开 Unity" />
      </label>
      <div className="code-actions">
        <button type="submit" className="note-button" disabled={running}>{currentResult?.suggestions.length ? '换一批' : '生成练习建议'}</button>
        {running && <button type="button" className="note-button secondary" onClick={() => {
          controller.current?.abort(); controller.current = null; setRunning(false);
        }}>停止</button>}
      </div>
      <small className="growth-muted">生成时会将偏好、已有成果标题及选取的资料摘要发送给 DeepSeek。</small>
    </form>
    {running && <p role="status">正在根据学习资料生成建议…</p>}
    {error && <p role="alert">{error}</p>}
    {saveMessage && <p role={saveMessage.error ? 'alert' : 'status'}>{saveMessage.text}</p>}
    {currentResult && !currentResult.suggestions.length && <p role="status">{currentResult.unavailable ? '还没有可参考的资料。可以先记一篇日志，或查看内置练习。' : '暂时没有符合条件的新建议。可以调整偏好，或查看内置练习。'}</p>}
    {!!currentResult?.suggestions.length && recordDisabledReason && <p className="growth-muted">{recordDisabledReason}</p>}
    {!!currentResult?.suggestions.length && <div className="assistant-growth-cards">{currentResult.suggestions.map((item) => {
      const sources = item.sources.map((index) => currentResult.sources[index - 1]);
      const domains = resultDomain ? [resultDomain] : [];
      const id = `recommended:${item.title}`;
      const existing = knownCards.find((card) => card.id === id || normalizedName(card.title) === normalizedName(item.title));
      const completed = existing && outcomes.some((outcome) => outcome.id === existing.id);
      const exercise = { id, title: item.title, domains, action: item.action, done: item.done, sources: {
        logIds: sources.filter(({ kind }) => kind === 'log').map(({ id }) => id),
        entryIds: sources.filter(({ kind }) => kind === 'entry').map(({ id }) => id),
        codeVersionIds: sources.filter(({ kind }) => kind === 'code').map(({ id }) => id),
      } };
      return <GrowthCard key={id} id={existing?.id ?? id} drag={existing ? undefined : { exercise }}
        card={{ title: item.title, domains, description: `${item.action}\n${PRACTICE_VERIFICATION_LABEL}：${item.done}` }} recordLabel={completed ? '追加实践' : '我做到了'}
        onRecord={recordDisabledReason ? undefined : () => onRecord(exercise)}
        actions={[{ label: completed ? '已有实践记录' : existing ? `已在「${PRACTICE_IDEAS_LABEL}」` : `加入「${PRACTICE_IDEAS_LABEL}」`, run: existing ? undefined : () => {
          try {
            saveExercise(exercise);
            setSaveMessage({ text: `「${item.title}」已加入「${PRACTICE_IDEAS_LABEL}」。` });
          } catch (error) {
            setSaveMessage({ text: error instanceof Error ? error.message : '保存练习失败。', error: true });
          }
        } }]}>
        <p>{item.action}</p>
        <p className="growth-completion"><strong>{PRACTICE_VERIFICATION_LABEL}</strong> {item.done}</p>
        <ul className="growth-source-list" aria-label="推荐依据">{sources.map((source) => <li key={source.href}>
          <a href={source.href} {...workspaceResourceTarget(source.href)} onClick={(event) => {
            const target = workspaceResourceTarget(source.href);
            event.currentTarget.target = target.target ?? '';
            event.currentTarget.rel = target.rel ?? '';
            if (!target.target && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) onNavigate();
          }}>{sourceLabels[source.kind]} · {source.title}</a>
        </li>)}</ul>
      </GrowthCard>;
    })}</div>}
  </section>;
}
