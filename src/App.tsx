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
import WorkspaceNavigation from './components/common/WorkspaceNavigation';
import RelationsWorkspace from './components/Relations/RelationsWorkspace';
import KnowledgeNetwork from './components/Relations/KnowledgeNetwork';
import AssistantDock from './components/Assistant/AssistantDock';
import type { AssistantStart } from './components/Assistant/AssistantGuide';
import type { GrowthDraft } from './components/Growth/GrowthPracticeForm';
import type { GrowthExerciseDraft } from './components/Growth/GrowthExerciseForm';
import type { SavedExercise, StudyLog as Log } from './types';
import { usePomodoroStore } from './store/pomodoroStore';
import { useStudyLogStore } from './store/studyLogStore';
import { useStreakStore } from './store/streakStore';
import { useCurrentGoalStore } from './store/currentGoalStore';
import { useGrowthStore } from './store/growthStore';
import { readWorkspaceHash, useWorkspaceStore } from './store/workspaceStore';
import { IS_KNOWLEDGE_DEMO } from './utils/workspaceMode';
import { generateId } from './utils/storage';
import { GROWTH_PRESETS } from './data/growthPresets';
import { normalizedName } from './utils/knowledge';
import { growthExercises } from './utils/growth';

const PAGES = [
  { id: 'today', label: '今日学习' },
  { id: 'path', label: '成长记录' },
  { id: 'history', label: '历史回顾' },
  { id: 'knowledge', label: '知识词条' },
  { id: 'network', label: '知识网络' },
  { id: 'data', label: '数据管理' },
  { id: 'code', label: '项目代码' },
  { id: 'relations', label: '关系视图' },
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
  const [growthDraft, setGrowthDraft] = useState<GrowthDraft | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<GrowthExerciseDraft>();
  const [addingCode, setAddingCode] = useState(false);
  const growthView = useWorkspaceStore((state) => state.growthView);
  const processedPomodorosRef = useRef(usePomodoroStore.getState().completedPomodoros);
  const completedPomodoros = usePomodoroStore((state) => state.completedPomodoros);
  const addDuration = useStudyLogStore((state) => state.addDuration);
  const todayLog = useStudyLogStore((state) => state.currentLog);
  const historyDate = useWorkspaceStore((state) => state.historyDate);
  const historyLog = useStudyLogStore((state) => state.logs.find((log) => log.date === historyDate));
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

  const activeLog = activePage === 'today' ? todayDraft ?? todayLog
    : activePage === 'history' ? historyDraft ?? historyLog : undefined;
  const assistantLog = activeLog ? {
    kind: activePage === 'today' ? 'today' as const : 'history' as const,
    log: activeLog,
    editing: activePage === 'today' ? Boolean(todayDraft) : Boolean(historyDraft),
  } : undefined;
  const openReview = (log: Log): string | undefined => {
    const saved = useStudyLogStore.getState().logs.find((item) => item.id === log.id);
    if (!saved) return '这篇日志已不存在，请重新选择。';
    if (todayDraft?.id === saved.id || (todayLog?.id === saved.id && historyDraft?.id !== saved.id)) {
      if (todayDraft && todayDraft.id !== saved.id) return '今日学习还有未保存的草稿，请先保存或取消。';
      setTodayDraft((draft) => draft ?? saved);
      window.location.hash = 'today';
      enterPage('today');
    } else {
      if (historyDraft && historyDraft.id !== saved.id) return `历史回顾还有 ${historyDraft.date} 的草稿，请先保存或取消。`;
      setHistoryDraft((draft) => draft ?? saved);
      useWorkspaceStore.getState().openLog(saved.date);
      enterPage('history');
    }
  };
  const startFromAssistant = (page: AssistantStart) => {
    if (page === 'today' && todayLog) setTodayDraft((draft) => draft ?? todayLog);
    if (page === 'path' && !exerciseDraft) setGrowthDraft((draft) => draft ?? { outcome: { id: generateId(), title: '', domains: [] }, preset: false });
    if (page === 'code') setAddingCode(true);
    window.location.hash = page;
    enterPage(page);
  };
  const recordRecommendation = ({ id, title, domains, action, sources }: SavedExercise) => {
    const { outcomes, exercises, hiddenPresetIds, groups } = useGrowthStore.getState();
    const saved = outcomes.find((item) => item.id === id || normalizedName(item.title) === normalizedName(title));
    const exercise = growthExercises({ exercises, hiddenPresetIds }).find((item) => item.id === id || normalizedName(item.title) === normalizedName(title));
    const existing = saved ?? exercise;
    const group = groups.find(({ cardIds }) => cardIds.includes(existing?.id ?? id));
    setGrowthDraft((draft) => draft ?? {
      outcome: { id: existing?.id ?? id, title: existing?.title ?? title, domains: existing?.domains ?? domains,
        description: saved?.description ?? exercise?.action ?? action },
      preset: GROWTH_PRESETS.some((item) => item.id === existing?.id),
      suggestedSources: exercises.find((item) => item.id === exercise?.id)?.sources ?? sources,
    });
    window.location.assign(group ? '#path?' + new URLSearchParams({ group: group.id }) : '#path');
    enterPage('path');
  };
  const pageLabel = activePage === 'path' && growthView === 'topics' ? '参考路径与任务'
    : PAGES.find((item) => item.id === activePage)?.label;

  return (
    <AssistantDock activePage={activePage} activeLog={assistantLog} onOpenReview={openReview} onStart={startFromAssistant}
      onRecordRecommendation={recordRecommendation} editingGrowth={Boolean(growthDraft || exerciseDraft)}>
    <div className="app-shell" data-knowledge-demo={IS_KNOWLEDGE_DEMO || undefined}>
      <header className="app-header">
        <a className="app-brand" href="#today" aria-label="游戏开发学习助手首页" title="游戏开发学习助手"><img src="/learning-assistant.svg" alt="" width="28" height="28" /></a>
        <WorkspaceNavigation activePage={activePage} activeLabel={pageLabel ?? '页面菜单'} growthView={growthView} />
        <h1>{pageLabel}</h1>
        {(activePage !== 'today' || todayDraft) && <SessionStatus editingToday={Boolean(todayDraft)} inToday={activePage === 'today'} />}
      </header>
      <div className="app-content">
      {IS_KNOWLEDGE_DEMO && <div className="knowledge-demo-banner">
        <strong>知识网络演示工作区</strong>
        <a href={window.location.pathname + '#network'}>返回个人知识网络</a>
      </div>}

      <main>
        {/* 保留各模块挂载，切换入口时维持计时、日期选择和未保存草稿。 */}
        <section id="today" className="workspace-panel today-layout" aria-label="今日学习" hidden={activePage !== 'today'} data-editing={Boolean(todayDraft) || undefined}>
          <Pomodoro />
          <StudyLog draft={todayDraft} setDraft={setTodayDraft} />
        </section>
        <section id="path" className="workspace-panel" aria-label="成长记录" hidden={activePage !== 'path'}>
          <GrowthWorkspace active={activePage === 'path'} draft={growthDraft} setDraft={setGrowthDraft}
            exerciseDraft={exerciseDraft} setExerciseDraft={setExerciseDraft} />
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
          <ProjectCodeWorkspace adding={addingCode} setAdding={setAddingCode} />
        </section>
        {activePage === 'relations' && <section id="relations" className="workspace-panel" aria-label="关系视图">
          <RelationsWorkspace />
        </section>}
      </main>
      </div>
      <DevTools />
    </div>
    </AssistantDock>
  );
}

export default App;
