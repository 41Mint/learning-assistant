import { useEffect, useRef, useState } from 'react';
import Pomodoro from './components/Pomodoro/Pomodoro';
import StudyLog from './components/StudyLog/StudyLog';
import Streak from './components/Streak/Streak';
import Statistics from './components/Statistics/Statistics';
import History from './components/History/History';
import SkillTree from './components/SkillTree/SkillTree';
import DataBackup from './components/DataManagement/DataBackup';
import DevTools from './components/DevTools/DevTools';
import KnowledgeBase from './components/Knowledge/KnowledgeBase';
import { usePomodoroStore } from './store/pomodoroStore';
import { useStudyLogStore } from './store/studyLogStore';
import { useStreakStore } from './store/streakStore';
import { useCurrentGoalStore } from './store/currentGoalStore';
import { readWorkspaceHash, useWorkspaceStore } from './store/workspaceStore';

const PAGES = [
  { id: 'today', label: '今日学习', description: '选择目标、专注学习，记录今天的收获。' },
  { id: 'path', label: '学习路径', description: '管理技能节点和具体任务，确定下一步学习目标。' },
  { id: 'history', label: '历史回顾', description: '按日期回看、补充笔记，了解学习投入。' },
  { id: 'knowledge', label: '知识词条', description: '整理自己的理解与疑问，从知识找回学习情境。' },
  { id: 'data', label: '数据管理', description: '导出完整备份，或从备份恢复学习记录与图片。' },
] as const;
type PageId = typeof PAGES[number]['id'];

function pageFromHash(): PageId | undefined {
  return PAGES.find((page) => page.id === readWorkspaceHash().page)?.id;
}

function SessionStatus() {
  const { isRunning, mode, timeLeft } = usePomodoroStore();
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  return (
    <a className="session-status" href="#today">
      <span className={`session-dot ${isRunning ? 'running' : ''}`} aria-hidden="true" />
      {mode === 'study' ? '学习' : '休息'}{isRunning ? '中' : '已暂停'} · {minutes}:{seconds}
      <span>返回计时器 →</span>
    </a>
  );
}

function App() {
  const [activePage, setActivePage] = useState<PageId>(() => pageFromHash() ?? 'today');
  const processedPomodorosRef = useRef(usePomodoroStore.getState().completedPomodoros);
  const completedPomodoros = usePomodoroStore((state) => state.completedPomodoros);
  const addDuration = useStudyLogStore((state) => state.addDuration);
  const updateStreak = useStreakStore((state) => state.updateStreak);
  const currentGoal = useCurrentGoalStore((state) => state.goal);

  useEffect(() => {
    const onHashChange = () => {
      const page = pageFromHash();
      useWorkspaceStore.getState().syncHash();
      if (page) setActivePage(page);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [activePage]);

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
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-eyebrow">LEARNING ASSISTANT</p>
          <h1>游戏开发学习助手</h1>
          <p className="app-description">{PAGES.find((page) => page.id === activePage)?.description}</p>
        </div>
        {activePage !== 'today' && <SessionStatus />}
      </header>

      <nav className="app-navigation" aria-label="主要功能">
        {PAGES.map((page) => (
          <a
            key={page.id}
            href={`#${page.id}`}
            aria-current={activePage === page.id ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActivePage(page.id);
              if (window.location.hash !== `#${page.id}`) window.location.hash = page.id;
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
          >
            {page.label}
          </a>
        ))}
      </nav>

      <main>
        {/* 保留各模块挂载，切换入口时维持计时、日期选择和未保存草稿。 */}
        <section id="today" className="workspace-panel today-layout" aria-label="今日学习" hidden={activePage !== 'today'}>
          <Pomodoro />
          <StudyLog />
        </section>
        <section id="path" className="workspace-panel" aria-label="学习路径" hidden={activePage !== 'path'}>
          <SkillTree />
        </section>
        <section id="history" className="workspace-panel history-layout" aria-label="历史回顾" hidden={activePage !== 'history'}>
          <History />
          <aside className="history-sidebar" aria-label="学习统计与打卡">
            <Statistics />
            <Streak />
          </aside>
        </section>
        <section id="data" className="workspace-panel" aria-label="数据管理" hidden={activePage !== 'data'}>
          <DataBackup />
        </section>
        <section id="knowledge" className="workspace-panel" aria-label="知识词条" hidden={activePage !== 'knowledge'}>
          <KnowledgeBase />
        </section>
      </main>
      <DevTools />
    </div>
  );
}

export default App;
