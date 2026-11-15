import { useLayoutEffect, useRef, useState } from 'react';
import { usePomodoroStore } from '../../store/pomodoroStore';
import { useStudyLogStore } from '../../store/studyLogStore';
import { emptyProjectCode } from '../../utils/projectCode';
import { replaceBackupAssets } from '../../utils/projectCodeStorage';
import { formatDate, generateId, getTodayDate, STORAGE_KEYS } from '../../utils/storage';
import { isTrashedLog, readStoredLogs } from '../../utils/studyLogs';
import { IS_TEST_WORKSPACE, STORAGE_PREFIX, TEST_WORKSPACE_HREF } from '../../utils/workspaceMode';
import WorkspaceDialog from '../common/WorkspaceDialog';

function recentDates(days: number) {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    return formatDate(date);
  });
}

function addStoredDurations(additions: { date: string; minutes: number; content: string }[]) {
  const logs = readStoredLogs();
  const now = Date.now();
  for (const { date, minutes, content } of additions) {
    const index = logs.findIndex((log) => log.date === date && !isTrashedLog(log));
    if (index >= 0) {
      logs[index] = { ...logs[index], duration: logs[index].duration + minutes, updatedAt: now };
    } else {
      logs.push({ id: generateId(), date, duration: minutes, content, tags: [], knowledgePoints: [], createdAt: now, updatedAt: now });
    }
  }
  localStorage.setItem(STORAGE_KEYS.STUDY_LOGS, JSON.stringify(logs));
  useStudyLogStore.getState().loadLogs();
}

type Position = { x: number; y: number };
const panelGap = 12;

function clampPosition({ x, y }: Position, { width, height }: Pick<DOMRect, 'width' | 'height'>): Position {
  return {
    x: Math.max(panelGap, Math.min(x, window.innerWidth - width - panelGap)),
    y: Math.max(panelGap, Math.min(y, window.innerHeight - height - panelGap)),
  };
}

export default function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>();
  const [confirmation, setConfirmation] = useState<'reset' | 'clear'>();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined);
  const completePomodoro = usePomodoroStore((state) => state.completePomodoro);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!isOpen || !element) return;
    closeButton.current?.focus({ preventScroll: true });
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      setPosition((current) => {
        if (!current) return current;
        const next = clampPosition(current, bounds);
        return current.x === next.x && current.y === next.y ? current : next;
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [isOpen]);

  if (!import.meta.env.DEV) return null;

  const close = () => {
    setIsOpen(false);
    drag.current = undefined;
    launcher.current?.focus({ preventScroll: true });
  };
  const run = (operation: () => void, message: string) => {
    try {
      operation();
      setNotice({ text: message });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : '操作失败，请重试。', error: true });
    }
  };
  const reset = async () => {
    usePomodoroStore.getState().pauseTimer();
    if (confirmation === 'reset') {
      const { prepareTestWorkspace } = await import('../../data/knowledgeDemo');
      await prepareTestWorkspace(true);
    } else {
      await replaceBackupAssets([], emptyProjectCode());
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
      }
    }
    window.location.reload();
  };
  const resetSamples = confirmation === 'reset';
  const personalPage = window.location.hash.split(/[/?]/, 1)[0] || '#today';

  return <>
    <button ref={launcher} type="button" className="dev-tools-launcher" title="开发者工具"
      aria-label="开发者工具" aria-expanded={isOpen} aria-controls={isOpen ? 'dev-tools-panel' : undefined}
      onClick={() => isOpen ? close() : setIsOpen(true)}><span aria-hidden="true">🛠</span></button>
    {isOpen && <section ref={panel} id="dev-tools-panel" className="dev-tools-panel" aria-labelledby="dev-tools-heading"
      style={position && { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing && !confirmation) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}>
      <header className="dev-tools-heading"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return;
          const bounds = panel.current?.getBoundingClientRect();
          if (!bounds) return;
          drag.current = { pointerId: event.pointerId, x: event.clientX - bounds.left, y: event.clientY - bounds.top };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const gesture = drag.current;
          const bounds = panel.current?.getBoundingClientRect();
          if (gesture?.pointerId === event.pointerId && bounds) {
            setPosition(clampPosition({ x: event.clientX - gesture.x, y: event.clientY - gesture.y }, bounds));
          }
        }}
        onLostPointerCapture={() => { drag.current = undefined; }}>
        <h2 id="dev-tools-heading">开发者工具</h2>
        <button ref={closeButton} type="button" className="workspace-icon-button" aria-label="关闭开发者工具" onClick={close}>×</button>
      </header>
      <div className="dev-tools-body">
        <div className="dev-tools-row">
          {IS_TEST_WORKSPACE ? <>
            <button type="button" className="note-button secondary" onClick={() => setConfirmation('reset')}>恢复示例数据</button>
            <a className="relation-entry-link" href={window.location.pathname + personalPage}>返回个人工作区</a>
          </> : <a className="relation-entry-link" href={TEST_WORKSPACE_HREF} target="_blank" rel="noopener">进入测试工作区</a>}
        </div>
        <div className="dev-tools-row" role="group" aria-label="生成模拟日志">
          <span>模拟日志</span>
          {[7, 14, 30].map((days) => <button type="button" className="note-button secondary" key={days}
            onClick={() => run(() => addStoredDurations(recentDates(days).map((date, index) => ({
              date, minutes: Math.floor(Math.random() * 126) + 25, content: `### 模拟学习记录\n\n第 ${index + 1} 天`,
            }))), `已生成 ${days} 天的模拟时长。`)}>{days} 天</button>)}
        </div>
        <div className="dev-tools-row" role="group" aria-label="添加今日学习时长">
          <span>今日时长</span>
          {[25, 50, 100].map((minutes) => <button type="button" className="note-button secondary" key={minutes}
            onClick={() => run(() => addStoredDurations([{ date: getTodayDate(), minutes, content: '### 测试学习记录' }]),
              `今日学习时长已增加 ${minutes} 分钟。`)}>+{minutes} 分</button>)}
        </div>
        <div className="dev-tools-row">
          <button type="button" className="note-button secondary"
            onClick={() => run(completePomodoro, '已模拟完成 1 个番茄钟。')}>模拟完成 1 个番茄钟</button>
          <button type="button" className="knowledge-text-button" onClick={() => run(() => {
            const logs = readStoredLogs().filter((log) => !isTrashedLog(log));
            console.table(logs.map(({ date, duration }) => ({ date, duration })));
          }, '学习时长已输出到控制台。')}>输出日志统计</button>
        </div>
        {!IS_TEST_WORKSPACE && <div className="dev-tools-row">
          <button type="button" className="knowledge-text-button danger" onClick={() => setConfirmation('clear')}>清空个人数据</button>
        </div>}
        {notice && <p className="dev-tools-notice" role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      </div>
      {confirmation && <WorkspaceDialog title={resetSamples ? '恢复示例数据' : '清空个人数据'}
        action={resetSamples ? '确认恢复' : '确认清空'} destructive onClose={() => setConfirmation(undefined)} onSave={reset}>
        <p>{resetSamples ? '恢复后，本浏览器在测试工作区所做的修改将被内置示例替换。'
          : '清空将删除本浏览器中的个人学习数据。此操作无法撤销。'}</p>
      </WorkspaceDialog>}
    </section>}
  </>;
}
