import { useState, useEffect, useMemo, useRef } from 'react';
import { useStudyLogStore } from '../../store/studyLogStore';
import { getTodayDate } from '../../utils/storage';
import CollapsibleNote from '../common/CollapsibleNote';
import KnowledgeLinks from '../Knowledge/KnowledgeLinks';
import CodeLinksPanel from '../ProjectCode/CodeLinksPanel';
import { useWorkspaceStore } from '../../store/workspaceStore';
import LogContentEditor from '../StudyLog/LogContentEditor';
import type { LogEditingProps } from '../StudyLog/LogContentEditor';

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
  const { logs, loadLogs, getLogByDate } = useStudyLogStore();
  const { historyDate: selectedDate, openLog } = useWorkspaceStore();
  const [calendarView, setCalendarView] = useState(() => ({ date: selectedDate, month: new Date(`${selectedDate}T12:00:00`) }));
  const currentMonth = useMemo(() => calendarView.date === selectedDate ? calendarView.month : new Date(`${selectedDate}T12:00:00`), [calendarView, selectedDate]);
  const [message, setMessage] = useState('');
  const editButton = useRef<HTMLButtonElement>(null);

  const selectDate = (date: string) => {
    setMessage('');
    openLog(date);
    setCalendarView({ date, month: new Date(`${date}T12:00:00`) });
  };

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

  const selectedLog = selectedDate ? getLogByDate(selectedDate) : null;

  const reading = (
    <div className="module-card history-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6" hidden={Boolean(draft)}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          📅 学习历史
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          查看过往的学习记录和统计
        </p>
      </div>

      <label className="history-date-picker">定位学习日期 <input aria-label="定位学习日期" type="date" value={selectedDate ?? ''} onChange={(event) => { if (event.target.value) selectDate(event.target.value); }} /></label>

      {/* 日历导航 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          ← 上月
        </button>

        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {currentMonth.getFullYear()} 年 {currentMonth.getMonth() + 1} 月
          </h3>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
          >
            今天
          </button>
        </div>

        <button
          onClick={goToNextMonth}
          className="px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          下月 →
        </button>
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
              className={`
                calendar-day p-2 rounded-lg text-sm transition-all relative
                ${!day.isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : ''}
                ${day.isToday ? 'ring-2 ring-blue-500' : ''}
                ${day.hasLog ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : 'cursor-not-allowed'}
                ${isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''}
                ${!day.hasLog && day.isCurrentMonth ? 'text-gray-300 dark:text-gray-700' : ''}
              `}
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
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {selectedDate}
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                学习时长：<span className="font-semibold text-blue-600 dark:text-blue-400">
                  {selectedLog.duration} 分钟
                </span>
              </div>
            </div>

            {/* 标签 */}
            {selectedLog.tags.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  {selectedLog.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 知识点 */}
            {selectedLog.knowledgePoints.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  {selectedLog.knowledgePoints.map(point => (
                    <span
                      key={point}
                      className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full"
                    >
                      💡 {point}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <KnowledgeLinks key={selectedLog.id} logId={selectedLog.id} legacyPoints={selectedLog.knowledgePoints} />
            <CodeLinksPanel key={selectedLog.id + '-code'} target={{ kind: 'log', id: selectedLog.id }} title="项目代码" />

            <div className="history-editor">
              <CollapsibleNote
                key={selectedLog.id}
                content={selectedLog.content}
                actions={<button ref={editButton} type="button" className="note-button" onClick={() => {
                  setMessage('');
                  setDraft(selectedLog);
                }}>编辑 / 补充记录</button>}
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
      {selectedDate && !selectedLog && <p className="text-sm text-gray-500 dark:text-gray-400">该日期暂无记录，可使用上方“导入图文学习记录”保存学习材料。</p>}
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
    </div>
  );
};

export default History;
