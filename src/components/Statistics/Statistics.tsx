import { useEffect, useMemo } from 'react';
import { useStudyLogStore } from '../../store/studyLogStore';
import { formatDate as formatLocalDate, getTodayDate } from '../../utils/storage';

interface DayData {
  date: string;
  minutes: number;
}

function createDayData(days: number, durationByDate: Map<string, number>): DayData[] {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    const dateString = formatLocalDate(date);
    return { date: dateString, minutes: durationByDate.get(dateString) ?? 0 };
  });
}

function formatDate(dateString: string, type: 'week' | 'month') {
  const date = new Date(dateString);
  if (type === 'week') {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function averageDuration(data: DayData[]) {
  const learningDays = data.filter((day) => day.minutes > 0);
  if (learningDays.length === 0) return 0;
  return Math.round(learningDays.reduce((sum, day) => sum + day.minutes, 0) / learningDays.length);
}

function BarChart({ data, type }: { data: DayData[]; type: 'week' | 'month' }) {
  const maxMinutes = Math.max(...data.map((day) => day.minutes), 60);
  const today = getTodayDate();

  return (
    <div style={{
      display: 'flex',
      height: '144px',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: '4px',
      border: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      padding: '8px',
    }}>
      {data.map((day) => {
        const isToday = day.date === today;
        const height = `${(day.minutes / maxMinutes) * 100}%`;
        return (
          <div key={day.date} style={{
            display: 'flex',
            minWidth: 0,
            flex: 1,
            height: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '4px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              width: '100%',
              height: '96px',
              overflow: 'hidden',
              borderRadius: '4px',
              backgroundColor: '#e5e7eb',
            }}>
              {day.minutes > 0 && (
                <div
                  style={{
                    width: '100%',
                    height,
                    minHeight: '6px',
                    borderRadius: '4px 4px 0 0',
                    background: isToday
                      ? 'linear-gradient(to top, #3b82f6, #60a5fa)'
                      : 'linear-gradient(to top, #9ca3af, #d1d5db)',
                    transition: 'height 0.3s ease',
                  }}
                  title={`${day.minutes} 分钟`}
                />
              )}
            </div>
            <span style={{
              fontSize: '12px',
              fontWeight: isToday ? 600 : 400,
              color: isToday ? '#2563eb' : '#6b7280',
            }}>
              {formatDate(day.date, type)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Statistics() {
  const { logs, loadLogs } = useStudyLogStore();

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const durationByDate = useMemo(
    () => new Map(logs.map((log) => [log.date, log.duration])),
    [logs],
  );
  const weekData = useMemo(() => createDayData(7, durationByDate), [durationByDate]);
  const monthData = useMemo(() => createDayData(30, durationByDate), [durationByDate]);
  const todayDuration = durationByDate.get(getTodayDate()) ?? 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">📊 学习统计</h2>

      <div className="mb-8 p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">今日学习时长</div>
        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
          {todayDuration}<span className="text-lg ml-2">分钟</span>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">本周学习曲线</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">平均: <span className="font-semibold">{averageDuration(weekData)}</span> 分钟/天</div>
        </div>
        <BarChart data={weekData} type="week" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">近 30 天学习曲线</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">平均: <span className="font-semibold">{averageDuration(monthData)}</span> 分钟/天</div>
        </div>
        <div className="overflow-x-auto"><div className="min-w-[720px]"><BarChart data={monthData} type="month" /></div></div>
      </div>

      <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">💡 统计直接读取学习日志；每完成一个番茄钟会自动累积 25 分钟。</p>
      </div>
    </div>
  );
}
