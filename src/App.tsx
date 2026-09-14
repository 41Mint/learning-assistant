import { useEffect } from 'react';
import Pomodoro from './components/Pomodoro/Pomodoro';
import StudyLog from './components/StudyLog/StudyLog';
import Streak from './components/Streak/Streak';
import { usePomodoroStore } from './store/pomodoroStore';
import { useStudyLogStore } from './store/studyLogStore';
import { useStreakStore } from './store/streakStore';

function App() {
  const completedPomodoros = usePomodoroStore((state) => state.completedPomodoros);
  const addDuration = useStudyLogStore((state) => state.addDuration);
  const updateStreak = useStreakStore((state) => state.updateStreak);

  // 当完成番茄钟时，自动增加学习时长并更新Streak
  useEffect(() => {
    if (completedPomodoros > 0) {
      addDuration(25); // 每完成一个番茄钟增加25分钟
      updateStreak(); // 更新连续学习天数
    }
  }, [completedPomodoros, addDuration, updateStreak]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🎮 游戏开发学习助手
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            保持学习动力，记录成长轨迹
          </p>
        </header>

        {/* 番茄钟 */}
        <section className="mb-8">
          <Pomodoro />
        </section>

        {/* 学习记录 */}
        <section className="mb-8">
          <StudyLog />
        </section>

        {/* 统计区域 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 连续学习 */}
          <Streak />

          {/* 学习统计 - 待开发 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 学习统计
            </h2>
            <p className="text-gray-500 dark:text-gray-400">即将推出...</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
