import { useEffect } from 'react';
import { usePomodoroStore } from '../../store/pomodoroStore';
import { useCurrentGoalStore } from '../../store/currentGoalStore';
import { PRACTICE_REFERENCE_LABEL } from '../../utils/growthLabels';

const formatTime = (seconds: number) =>
  String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');

export default function Pomodoro() {
  const { isRunning, timeLeft, mode, studyDuration, breakDuration, completedPomodoros, startTimer, pauseTimer, resetTimer, switchMode, tick } = usePomodoroStore();
  const { goal, loadCurrentGoal, clearCurrentGoal } = useCurrentGoalStore();
  const isPracticeReference = goal?.type === 'growth-card';
  const duration = mode === 'study' ? studyDuration : breakDuration;
  const progress = duration ? Math.min(1, Math.max(0, 1 - timeLeft / duration)) : 0;

  useEffect(() => {
    loadCurrentGoal();
  }, [loadCurrentGoal]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  return (
    <div className="module-card pomodoro-card" data-mode={mode}>
      <div className="timer-mode">{mode === 'study' ? '学习时间' : '休息时间'}</div>
      <div className="timer-goal" data-has-goal={Boolean(goal) || undefined}>
        <span>{isPracticeReference ? PRACTICE_REFERENCE_LABEL : '当前学习目标'}</span>
        <strong>{goal?.label ?? '可以直接开始学习'}</strong>
        {goal && <button type="button" className="knowledge-text-button" onClick={clearCurrentGoal}>
          {isPracticeReference ? '移除练习参考' : '清除当前目标'}
        </button>}
      </div>

      <div>
        <div data-testid="timer-display" className="timer-display">{formatTime(timeLeft)}</div>
        <div className="timer-completed">今日完成 {completedPomodoros} 个番茄钟</div>
      </div>
      <div className="timer-progress" aria-hidden="true"><span style={{ width: progress * 100 + '%' }} /></div>
      <div className="timer-controls">
        <button type="button" onClick={isRunning ? pauseTimer : startTimer}>{isRunning ? '⏸️ 暂停' : '▶️ 开始'}</button>
        <button type="button" onClick={resetTimer}>🔄 重置</button>
        <button type="button" onClick={switchMode}>🔀 切换</button>
      </div>
      <p className="timer-durations">{studyDuration / 60} 分钟学习 · {breakDuration / 60} 分钟休息</p>
    </div>
  );
}
