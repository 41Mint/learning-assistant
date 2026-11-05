import { useEffect } from 'react';
import { usePomodoroStore } from '../../store/pomodoroStore';
import { useCurrentGoalStore } from '../../store/currentGoalStore';

// 格式化时间显示（MM:SS）
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function Pomodoro() {
  const {
    isRunning,
    timeLeft,
    mode,
    completedPomodoros,
    startTimer,
    pauseTimer,
    resetTimer,
    switchMode,
    tick,
  } = usePomodoroStore();
  const { goal, loadCurrentGoal } = useCurrentGoalStore();

  useEffect(() => {
    loadCurrentGoal();
  }, [loadCurrentGoal]);

  // 计时器效果
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, tick]);

  return (
    <div className="module-card pomodoro-card bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      {/* 模式指示 */}
      <div className="text-center mb-4">
        <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
          mode === 'study'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        }`}>
          {mode === 'study' ? '📚 学习时间' : '☕ 休息时间'}
        </span>
      </div>

      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-center dark:border-blue-900/60 dark:bg-blue-900/20">
        <div className="text-xs font-medium text-blue-700 dark:text-blue-300">当前学习目标</div>
        <div className="mt-1 text-sm font-semibold text-blue-950 dark:text-blue-100">
          {goal ? goal.label : '暂未选择，可在学习路径中设置'}
        </div>
      </div>

      {/* 计时器显示 */}
      <div className="text-center mb-6">
        <div data-testid="timer-display" className="timer-display text-6xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          {formatTime(timeLeft)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          今日完成: {completedPomodoros} 个番茄钟
        </div>
      </div>

      {/* 进度条 */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
        <div
          className={`h-2 rounded-full transition-all ${
            mode === 'study' ? 'bg-blue-500' : 'bg-green-500'
          }`}
          style={{
            width: `${((mode === 'study'
              ? 25 * 60 - timeLeft
              : 5 * 60 - timeLeft) / (mode === 'study' ? 25 * 60 : 5 * 60)) * 100}%`,
          }}
        />
      </div>

      {/* 控制按钮 */}
      <div className="timer-controls flex gap-3 justify-center">
        <button
          onClick={isRunning ? pauseTimer : startTimer}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
            isRunning
              ? 'bg-yellow-500 hover:bg-yellow-600'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isRunning ? '⏸️ 暂停' : '▶️ 开始'}
        </button>

        <button
          onClick={resetTimer}
          className="px-6 py-3 rounded-lg font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          🔄 重置
        </button>

        <button
          onClick={switchMode}
          className="px-6 py-3 rounded-lg font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          🔀 切换
        </button>
      </div>

      {/* 说明文字 */}
      <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>使用番茄工作法提高专注力</p>
        <p className="mt-1">25分钟学习 + 5分钟休息</p>
      </div>
    </div>
  );
}
