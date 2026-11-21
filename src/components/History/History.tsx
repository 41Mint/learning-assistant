import { useState, useEffect, useMemo, useRef } from 'react';
import { useStudyLogStore } from '../../store/studyLogStore';
import { getTodayDate } from '../../utils/storage';
import CollapsibleNote from '../common/CollapsibleNote';
import HighlightedText from '../common/HighlightedText';
import { useScrollToSearchMatch } from '../common/useScrollToSearchMatch';
import KnowledgeLinks from '../Knowledge/KnowledgeLinks';
import CodeLinksPanel from '../ProjectCode/CodeLinksPanel';
import RelationLink from '../Relations/RelationLink';
import { useWorkspaceStore } from '../../store/workspaceStore';
import LogContentEditor from '../StudyLog/LogContentEditor';
import type { LogEditingProps } from '../StudyLog/LogContentEditor';
import TrashLogButton from '../StudyLog/TrashLogButton';
import LogMetadataField from '../StudyLog/LogMetadataField';
import LogTaskLinks from '../StudyLog/LogTaskLinks';
import useMarkdownImport from '../StudyLog/useMarkdownImport';

interface CalendarDay {
  date: string; // YYYY-MM-DD
  isToday: boolean;
  isCurrentMonth: boolean;
  hasLog: boolean;
  duration: number;
}

const formatDateStr = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const History = ({ draft, setDraft }: LogEditingProps) => {
  const { logs, loadLogs, getLogByDate, changeTag, renameTag } = useStudyLogStore();
  const { historyDate: selectedDate, openLog, search: searchLocation } = useWorkspaceStore();
  const [calendarView, setCalendarView] = useState(() => ({ date: selectedDate, month: new Date(`${selectedDate}T12:00:00`) }));
  const currentMonth = useMemo(() => calendarView.date === selectedDate ? calendarView.month : new Date(`${selectedDate}T12:00:00`), [calendarView, selectedDate]);
  const [message, setMessage] = useState('');
  const [deletedDate, setDeletedDate] = useState('');
  const editButton = useRef<HTMLButtonElement>(null);
  const record = useRef<HTMLDivElement>(null);
  const selectedLog = selectedDate ? getLogByDate(selectedDate) : null;
  const search = searchLocation?.page === 'history' && searchLocation.id === selectedDate ? searchLocation : null;
  useScrollToSearchMatch(record, search, selectedLog?.content);

  const selectDate = (date: string) => {
    setMessage('');
    openLog(date);
    setCalendarView({ date, month: new Date(`${date}T12:00:00`) });
  };

  const { trigger: importButton, dialog: importDialog } = useMarkdownImport({
    initialDate: selectedDate,
    onOpen: () => setMessage(''),
    onImported: (date, imageCount) => {
      if (date !== selectedDate) selectDate(date);
      setMessage(`已保存到 ${date} 的学习记录，共 ${imageCount} 张图片。`);
    },
  });

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const today = getTodayDate();

    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // 获取第一天是星期几（0=周日，1=周一，...）
    const firstDayOfWeek = firstDay.getDay();

    // 获取上个月需要显示的天数
    const prevMonthDays = firstDayOfWeek;
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    // 添加上个月的日期
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(year, month - 1, day);
      const dateStr = formatDateStr(date);
      const log = logs.find(l => l.date === dateStr);

      days.push({
        date: dateStr,
        isToday: false,
        isCurrentMonth: false,
        hasLog: !!log,
        duration: log?.duration || 0,
      });
    }

    // 添加当月的日期
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDateStr(date);
      const log = logs.find(l => l.date === dateStr);

      days.push({
        date: dateStr,
        isToday: dateStr === today,
        isCurrentMonth: true,
        hasLog: !!log,
        duration: log?.duration || 0,
      });
    }

    // 添加下个月的日期，补齐到42天（6周）
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateStr = formatDateStr(date);
      const log = logs.find(l => l.date === dateStr);

      days.push({
        date: dateStr,
        isToday: false,
        isCurrentMonth: false,
        hasLog: !!log,
        duration: log?.duration || 0,
      });
    }

    return days;
  }, [currentMonth, logs]);

  const goToPrevMonth = () => {
    setCalendarView({ date: selectedDate, month: new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1) });
  };

  const goToNextMonth = () => {
    setCalendarView({ date: selectedDate, month: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1) });
  };

  const goToToday = () => {
    selectDate(getTodayDate());
  };

  const handleDayClick = (day: CalendarDay) => {
    if (day.hasLog) {
      selectDate(day.date);
    }
  };

  const reading = (
    <div className="module-card history-card" hidden={Boolean(draft)}>
      <h2>学习历史</h2>

      <label className="history-date-picker">定位学习日期 <input className="workspace-input" aria-label="定位学习日期" type="date" value={selectedDate ?? ''} onChange={(event) => { if (event.target.value) selectDate(event.target.value); }} /></label>

      <div className="history-calendar-nav" role="group" aria-label="切换月份">
        <button type="button" className="workspace-button" onClick={goToPrevMonth}>← 上月</button>
        <div className="history-calendar-month">
          <h3>{currentMonth.getFullYear()} 年 {currentMonth.getMonth() + 1} 月</h3>
          <button type="button" className="workspace-button" onClick={goToToday}>今天</button>
        </div>
        <button type="button" className="workspace-button" onClick={goToNextMonth}>下月 →</button>
      </div>

      {/* 星期标题 */}
      <div className="history-weekdays">
        {['日', '一', '二', '三', '四', '五', '六'].map(day => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日历格子 */}
      <div className="history-calendar">
        {calendarDays.map((day, index) => {
          const dayNum = parseInt(day.date.split('-')[2]);
          const isSelected = selectedDate === day.date;

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleDayClick(day)}
              disabled={!day.hasLog}
              aria-label={`${day.date}${day.hasLog ? `，学习 ${day.duration} 分钟` : '，无记录'}`}
              aria-pressed={isSelected}
              data-today={day.isToday || undefined}
              data-outside-month={!day.isCurrentMonth || undefined}
              className="calendar-day"
            >
              <div className="font-medium">{dayNum}</div>
              {day.hasLog && (
                <span className="calendar-marker" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* 选中日期的详细信息 */}
      {selectedLog && (
        <div ref={record} className="history-record">
          <div className="mb-4">
            <div className="history-card-heading">
              <h3>
                <HighlightedText text={selectedDate} words={search?.words} />
              </h3>
              <span>学习时长 {selectedLog.duration} 分钟</span>
            </div>

            <LogMetadataField key={'tags-' + selectedLog.id} label="标签" sectionLabel="编辑标签" placeholder="例如 Unity、C#、算法"
              items={selectedLog.tags} searchWords={search?.words}
              onAdd={(tag) => changeTag(selectedLog.id, tag, true)} onRemove={(tag) => changeTag(selectedLog.id, tag, false)}
              onRename={(previous, next) => renameTag(selectedLog.id, previous, next)} />

            {selectedLog.knowledgePoints.length > 0 && (
              <ul className="log-chips history-log-chips" aria-label="学到的知识点">
                {selectedLog.knowledgePoints.map(point => <li className="log-chip" key={point}>
                  <HighlightedText text={point} words={search?.words} />
                </li>)}
              </ul>
            )}

            <LogTaskLinks key={selectedLog.id + '-tasks'} log={selectedLog} />
            <KnowledgeLinks key={selectedLog.id} logId={selectedLog.id} legacyPoints={selectedLog.knowledgePoints} />
            <CodeLinksPanel key={selectedLog.id + '-code'} target={{ kind: 'log', id: selectedLog.id }} title="项目代码" />

            <div className="history-editor">
              <CollapsibleNote
                key={selectedLog.id}
                content={selectedLog.content}
                search={search}
                actions={<>
                  {importButton}
                  <button ref={editButton} type="button" className="note-button" onClick={() => {
                    setMessage('');
                    setDraft(selectedLog);
                  }}>编辑 / 补充记录</button>
                  <RelationLink kind="log" id={selectedLog.id} />
                  <TrashLogButton log={selectedLog} onMoved={() => setDeletedDate(selectedLog.date)} />
                </>}
              />
              {message && <p role="status">{message}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {!selectedDate && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          点击有绿点的日期查看当天的学习记录
        </div>
      )}
      {selectedDate && !selectedLog && (
        <div className="history-record">
          {selectedDate === deletedDate
            ? <p role="status">日志已移入<a href="#data">回收站</a>。</p>
            : <p className="text-sm text-gray-500 dark:text-gray-400">该日期暂无学习记录。</p>}
          <div className="history-note-actions">{importButton}</div>
        </div>
      )}
    </div>
  );

  return (
    <div id="study-history">
      {draft && <LogContentEditor key={draft.id} log={draft} kind="history" onClose={(saved) => {
        setDraft(null);
        if (saved) {
          setMessage('补充内容已保存。');
          if (selectedDate !== draft.date) openLog(draft.date);
        }
        window.requestAnimationFrame(() => editButton.current?.focus());
      }} />}
      {reading}
      {importDialog}
    </div>
  );
};

export default History;
