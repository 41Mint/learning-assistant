import { useEffect, useRef } from 'react';
import Pomodoro from './components/Pomodoro/Pomodoro';
import StudyLog from './components/StudyLog/StudyLog';
import Streak from './components/Streak/Streak';
import Statistics from './components/Statistics/Statistics';
import History from './components/History/History';
import SkillTree from './components/SkillTree/SkillTree';
import DataBackup from './components/DataManagement/DataBackup';
import DevTools from './components/DevTools/DevTools';
import { usePomodoroStore } from './store/pomodoroStore';
import { useStudyLogStore } from './store/studyLogStore';
import { useStreakStore } from './store/streakStore';
import { useCurrentGoalStore } from './store/currentGoalStore';

function App() {
  const processedPomodorosRef = useRef(0);
  const completedPomodoros = usePomodoroStore((state) => state.completedPomodoros);
  const addDuration = useStudyLogStore((state) => state.addDuration);
  const updateStreak = useStreakStore((state) => state.updateStreak);
  const currentGoal = useCurrentGoalStore((state) => state.goal);

  // 当完成番茄钟时，自动增加学习时长并更新Streak
  useEffect(() => {
    const newlyCompleted = completedPomodoros - processedPomodorosRef.current;
    if (newlyCompleted > 0) {
      addDuration(25 * newlyCompleted, currentGoal ? `目标：${currentGoal.label}` : undefined);
      updateStreak(); // 更新连续学习天数
      processedPomodorosRef.current = completedPomodoros;
    }
  }, [completedPomodoros, currentGoal, addDuration, updateStreak]);

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
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 连续学习 */}
          <Streak />

          {/* 学习统计 */}
          <Statistics />
        </section>

        {/* 学习路径 */}
        <section className="mb-8">
          <SkillTree />
        </section>

        {/* 历史记录 */}
        <section className="mb-8">
          <History />
        </section>

        <section className="mb-8">
          <DataBackup />
        </section>
      </div>

      {/* 开发者工具（仅开发环境） */}
      <DevTools />
    </div>
  );
}

export default App;
