import { useEffect, useState } from 'react';
import { useStudyLogStore } from '../../store/studyLogStore';

interface DayData {
  date: string;
  minutes: number;
}

export default function Statistics() {
  const { getTodayLog } = useStudyLogStore();
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [todayDuration, setTodayDuration] = useState(0);

  // 加载今日学习时长（从 localStorage 直接读取）
  const loadTodayDuration = () => {
    const today = new Date().toISOString().split('T')[0];
    const logData = localStorage.getItem(`learning-assistant:log:${today}`);
    if (logData) {
      const { duration } = JSON.parse(logData);
      setTodayDuration(duration);
    } else {
      setTodayDuration(0);
    }
  };

  useEffect(() => {
    getTodayLog();
    loadWeekData();
    loadMonthData();
    loadTodayDuration();

    // 每5秒检查一次数据更新（用于实时显示开发者工具添加的数据）
    const interval = setInterval(() => {
      loadWeekData();
      loadMonthData();
      loadTodayDuration();
    }, 5000);

    return () => clearInterval(interval);
  }, [getTodayLog]);

  // 加载本周数据
  const loadWeekData = () => {
    const data: DayData[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // 从localStorage读取该日期的数据
      const logData = localStorage.getItem(`learning-assistant:log:${dateStr}`);
      const minutes = logData ? JSON.parse(logData).duration : 0;

      data.push({
        date: dateStr,
        minutes,
      });
    }

    setWeekData(data);
  };

  // 加载本月数据
  const loadMonthData = () => {
    const data: DayData[] = [];
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    for (let i = daysInMonth - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const logData = localStorage.getItem(`learning-assistant:log:${dateStr}`);
      const minutes = logData ? JSON.parse(logData).duration : 0;

      data.push({
        date: dateStr,
        minutes,
      });
    }

    setMonthData(data);
  };

  // 格式化日期显示
  const formatDate = (dateStr: string, type: 'week' | 'month') => {
    const date = new Date(dateStr);
    if (type === 'week') {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return days[date.getDay()];
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  // 计算平均学习时长
  const getAverageDuration = (data: DayData[]) => {
    const validDays = data.filter(d => d.minutes > 0);
    if (validDays.length === 0) return 0;
    const total = validDays.reduce((sum, d) => sum + d.minutes, 0);
    return Math.round(total / validDays.length);
  };

  // 渲染柱状图
  const renderBarChart = (data: DayData[], type: 'week' | 'month') => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-700/20 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 text-sm">暂无数据</p>
        </div>
      );
    }

    const maxMinutes = Math.max(...data.map(d => d.minutes), 60); // 最小基准60分钟，确保图表比例合理

    return (
      <div className="flex items-end justify-between gap-1 h-32">
        {data.map((day) => {
          const heightPercent = Math.max((day.minutes / maxMinutes) * 100, 0);
          const isToday = day.date === new Date().toISOString().split('T')[0];

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              {/* 柱子容器 */}
              <div className="w-full flex flex-col justify-end h-24 bg-gray-100 dark:bg-gray-700/30 rounded relative overflow-hidden">
                {day.minutes > 0 && (
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      isToday
                        ? 'bg-gradient-to-t from-blue-500 to-blue-400'
                        : 'bg-gradient-to-t from-gray-400 to-gray-300 dark:from-gray-500 dark:to-gray-400'
                    }`}
                    style={{
                      height: `${heightPercent}%`,
                      minHeight: day.minutes > 0 ? '6px' : '0'
                    }}
                    title={`${day.minutes}分钟`}
                  />
                )}
              </div>

              {/* 日期标签 */}
              <div
                className={`text-xs transition-colors ${
                  isToday
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {formatDate(day.date, type)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const weekAverage = getAverageDuration(weekData);
  const monthAverage = getAverageDuration(monthData);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        📊 学习统计
      </h2>

      {/* 今日学习时长 */}
      <div className="mb-8 p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          今日学习时长
        </div>
        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
          {todayDuration}
          <span className="text-lg ml-2">分钟</span>
        </div>
      </div>

      {/* 本周学习曲线 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            本周学习曲线
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            平均: <span className="font-semibold">{weekAverage}</span> 分钟/天
          </div>
        </div>
        {renderBarChart(weekData, 'week')}
      </div>

      {/* 本月学习曲线 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            本月学习曲线
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            平均: <span className="font-semibold">{monthAverage}</span> 分钟/天
          </div>
        </div>
        <div className="overflow-x-auto">
          {renderBarChart(monthData, 'month')}
        </div>
      </div>

      {/* 说明文字 */}
      <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          💡 提示：每完成一个番茄钟（25分钟）会自动记录到统计中
        </p>
      </div>
    </div>
  );
}
