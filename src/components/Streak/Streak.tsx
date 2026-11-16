import { useEffect } from 'react';
import { useStreakStore } from '../../store/streakStore';

export default function Streak() {
  const { currentStreak, longestStreak, totalDays, loadStreak, hasStudiedToday } = useStreakStore();
  const checkedIn = hasStudiedToday();

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  return <section className="module-card streak-card" aria-label="连续学习">
    <div className="history-card-heading">
      <h2>连续学习</h2>
      <span className="streak-status" data-checked-in={checkedIn || undefined}>{checkedIn ? '已打卡' : '待打卡'}</span>
    </div>
    <dl className="streak-metrics">
      <div><dt>当前连续</dt><dd>{currentStreak} <small>天</small></dd></div>
      <div><dt>最长连续</dt><dd>{longestStreak} <small>天</small></dd></div>
      <div><dt>累计学习</dt><dd>{totalDays} <small>天</small></dd></div>
    </dl>
    {!checkedIn && <p className="streak-hint">完成一个番茄钟即可打卡。</p>}
  </section>;
}
