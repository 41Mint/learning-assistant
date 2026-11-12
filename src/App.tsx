import { useCallback, useEffect, useRef, useState } from 'react';
import Pomodoro from './components/Pomodoro/Pomodoro';
import StudyLog from './components/StudyLog/StudyLog';
import Streak from './components/Streak/Streak';
import Statistics from './components/Statistics/Statistics';
import History from './components/History/History';
import GrowthWorkspace from './components/Growth/GrowthWorkspace';
import DataBackup from './components/DataManagement/DataBackup';
import DevTools from './components/DevTools/DevTools';
import KnowledgeBase from './components/Knowledge/KnowledgeBase';
import ProjectCodeWorkspace from './components/ProjectCode/ProjectCodeWorkspace';
import ResourceSearch from './components/Search/ResourceSearch';
import RelationsWorkspace from './components/Relations/RelationsWorkspace';
import KnowledgeNetwork from './components/Relations/KnowledgeNetwork';
import type { StudyLog as Log } from './types';
import { usePomodoroStore } from './store/pomodoroStore';
import { useStudyLogStore } from './store/studyLogStore';
import { useStreakStore } from './store/streakStore';
import { useCurrentGoalStore } from './store/currentGoalStore';
import { readWorkspaceHash, useWorkspaceStore } from './store/workspaceStore';
import { IS_KNOWLEDGE_DEMO } from './utils/workspaceMode';

const PAGES = [
  { id: 'today', label: '今日学习', description: '随时开始专注，记录今天的学习。' },
  { id: 'path', label: '成长记录', description: '回看做成的事，记录每一次新的实践。' },
  { id: 'history', label: '历史回顾', description: '按日期回看、补充笔记，了解学习投入。' },
  { id: 'knowledge', label: '知识词条', description: '整理自己的理解与疑问，从知识找回学习情境。' },
  { id: 'network', label: '知识网络', description: '在画布上查看和整理词条、学习日志与代码的关联。' },
  { id: 'data', label: '数据管理', description: '导出完整备份，或从备份恢复学习资料。' },
  { id: 'code', label: '项目代码', description: '回看具体版本的脚本和引用它们的学习经历。' },
  { id: 'relations', label: '关系视图', description: '查看当前资料与其他学习资料的直接关联。' },
] as const;
type PageId = typeof PAGES[number]['id'];

function pageFromHash(): PageId | undefined {
  return PAGES.find((page) => page.id === readWorkspaceHash().page)?.id;
}

function SessionStatus({ editingToday, inToday }: { editingToday: boolean; inToday: boolean }) {
  const { isRunning, mode, timeLeft, startTimer, pauseTimer } = usePomodoroStore();
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  const status = (
    <>
      <span className={`session-dot ${isRunning ? 'running' : ''}`} aria-hidden="true" />
      {mode === 'study' ? '学习' : '休息'}{isRunning ? '中' : '已暂停'} · {minutes}:{seconds}
    </>
  );
  return inToday ? (
    <div className="session-status">
      {status}
      <button type="button" onClick={isRunning ? pauseTimer : startTimer}>{isRunning ? '暂停计时' : '开始计时'}</button>
    </div>
  ) : (
    <a className="session-status" href="#today">
      {status}
      <span>{editingToday ? '返回今日编辑 →' : '返回计时器 →'}</span>
    </a>
  );
}

function App() {
  const [activePage, setActivePage] = useState<PageId>(() => pageFromHash() ?? 'today');
  const [networkVisited, setNetworkVisited] = useState(activePage === 'network');
  const [todayDraft, setTodayDraft] = useState<Log | null>(null);
  const [historyDraft, setHistoryDraft] = useState<Log | null>(null);
  const processedPomodorosRef = useRef(usePomodoroStore.getState().completedPomodoros);
  const completedPomodoros = usePomodoroStore((state) => state.completedPomodoros);
  const addDuration = useStudyLogStore((state) => state.addDuration);
  const updateStreak = useStreakStore((state) => state.updateStreak);
  const currentGoal = useCurrentGoalStore((state) => state.goal);
  const enterPage = useCallback((page: PageId) => {
    setActivePage(page);
    if (page === 'network') setNetworkVisited(true);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const page = pageFromHash();
      useWorkspaceStore.getState().syncHash();
      if (page) enterPage(page);
      else if (!window.location.hash) enterPage('today');
    };
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [enterPage]);

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
    <div className="app-shell" data-knowledge-demo={IS_KNOWLEDGE_DEMO || undefined}>
      {IS_KNOWLEDGE_DEMO && <div className="knowledge-demo-banner">
        <strong>知识网络演示工作区</strong>
        <a href={window.location.pathname + '#network'}>返回个人知识网络</a>
      </div>}
      <header className="app-header">
        <div>
          <p className="app-eyebrow">LEARNING ASSISTANT</p>
          <h1>游戏开发学习助手</h1>
          <p className="app-description">{PAGES.find((page) => page.id === activePage)?.description}</p>
        </div>
        {(activePage !== 'today' || todayDraft) && <SessionStatus editingToday={Boolean(todayDraft)} inToday={activePage === 'today'} />}
      </header>

      <nav className="app-navigation" aria-label="主要功能">
        {PAGES.filter((page) => page.id !== 'code' && page.id !== 'relations').map((page) => (
          <a
            key={page.id}
            href={`#${page.id}`}
            aria-current={activePage === page.id || (activePage === 'code' && page.id === 'path') ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              enterPage(page.id);
              if (window.location.hash !== `#${page.id}`) window.location.hash = page.id;
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
          >
            {page.label}
          </a>
        ))}
        <ResourceSearch />
      </nav>

      <main>
        {/* 保留各模块挂载，切换入口时维持计时、日期选择和未保存草稿。 */}
        <section id="today" className="workspace-panel today-layout" aria-label="今日学习" hidden={activePage !== 'today'} data-editing={Boolean(todayDraft) || undefined}>
          <Pomodoro />
          <StudyLog draft={todayDraft} setDraft={setTodayDraft} />
        </section>
        <section id="path" className="workspace-panel" aria-label="成长记录" hidden={activePage !== 'path'}>
          <GrowthWorkspace />
        </section>
        <section id="history" className="workspace-panel history-layout" aria-label="历史回顾" hidden={activePage !== 'history'} data-editing={Boolean(historyDraft) || undefined}>
          <History draft={historyDraft} setDraft={setHistoryDraft} />
          <aside className="history-sidebar" aria-label="学习统计与打卡" hidden={Boolean(historyDraft)}>
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
        {networkVisited && <section id="network" className="workspace-panel" aria-label="知识网络" hidden={activePage !== 'network'}>
          <KnowledgeNetwork active={activePage === 'network'} />
        </section>}
        <section id="code" className="workspace-panel" aria-label="项目代码" hidden={activePage !== 'code'}>
          <ProjectCodeWorkspace />
        </section>
        {activePage === 'relations' && <section id="relations" className="workspace-panel" aria-label="关系视图">
          <RelationsWorkspace />
        </section>}
      </main>
      <DevTools />
    </div>
  );
}

export default App;
