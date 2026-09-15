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

  // 渲染柱状图 - 使用内联样式
  const renderBarChart = (data: DayData[], type: 'week' | 'month') => {
    console.log(`🎨 renderBarChart 被调用 - type: ${type}, data.length: ${data.length}`);

    if (data.length === 0) {
      console.log('⚠️ 数据长度为0，显示暂无数据');
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '128px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          border: '2px solid #eab308'
        }}>
          <p style={{ color: '#111827', fontSize: '18px', fontWeight: 'bold' }}>📭 暂无数据</p>
        </div>
      );
    }

    const maxMinutes = Math.max(...data.map(d => d.minutes), 60);
    console.log(`📊 maxMinutes: ${maxMinutes}`);
    console.log(`📊 数据预览:`, data.slice(0, 3));

    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '4px',
        height: '128px',
        border: '2px solid #22c55e',
        padding: '8px',
        borderRadius: '8px'
      }}>
        {data.map((day, index) => {
          const heightPercent = Math.max((day.minutes / maxMinutes) * 100, 0);
          const isToday = day.date === new Date().toISOString().split('T')[0];

          if (index < 3) {
            console.log(`柱子 ${index}: ${day.date}, ${day.minutes}分钟, 高度${heightPercent}%`);
          }

          return (
            <div key={day.date} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px'
            }}>
              {/* 柱子容器 */}
              <div style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                height: '96px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid #e5e7eb'
              }}>
                {day.minutes > 0 && (
                  <div
                    style={{
                      width: '100%',
                      borderRadius: '4px 4px 0 0',
                      transition: 'all 0.3s',
                      background: isToday
                        ? 'linear-gradient(to top, #3b82f6, #60a5fa)'
                        : 'linear-gradient(to top, #9ca3af, #d1d5db)',
                      height: `${heightPercent}%`,
                      minHeight: day.minutes > 0 ? '6px' : '0'
                    }}
                    title={`${day.minutes}分钟`}
                  />
                )}
              </div>

              {/* 日期标签 */}
              <div style={{
                fontSize: '12px',
                color: isToday ? '#2563eb' : '#6b7280',
                fontWeight: isToday ? 600 : 400,
                transition: 'color 0.3s'
              }}>
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

  // 🐛 调试：实时显示组件状态
  useEffect(() => {
    console.log('=== Statistics 组件渲染调试 ===');
    console.log('weekData 长度:', weekData.length);
    console.log('weekData 内容:', weekData);
    console.log('monthData 长度:', monthData.length);
    console.log('todayDuration:', todayDuration);
  }, [weekData, monthData, todayDuration]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        📊 学习统计 <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">v2.0-DEBUG</span>
      </h2>

      {/* 🧪 硬编码测试块 - 如果你能看到这个，说明新代码已加载 */}
      <div className="mb-4 p-4 bg-yellow-200 dark:bg-yellow-900 border-4 border-red-600 rounded-lg">
        <p className="text-2xl font-bold text-black dark:text-white">
          ⚠️ 测试块：如果看到这个黄色区域和红色边框，说明新代码已加载！
        </p>
      </div>

      {/* 🧪 直接硬编码的柱状图测试 - 使用内联样式 */}
      <div style={{
        marginBottom: '24px',
        border: '4px solid #22c55e',
        padding: '16px',
        backgroundColor: '#f3e8ff',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '20px' }}>
          🧪 硬编码测试图表（使用内联样式）
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '4px',
          height: '128px',
          backgroundColor: '#ffffff',
          padding: '8px',
          border: '2px solid #3b82f6'
        }}>
          <div style={{ width: '48px', height: '80px', backgroundColor: '#ef4444' }}></div>
          <div style={{ width: '48px', height: '64px', backgroundColor: '#3b82f6' }}></div>
          <div style={{ width: '48px', height: '96px', backgroundColor: '#22c55e' }}></div>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#eab308' }}></div>
        </div>
      </div>

      {/* 🐛 实时调试信息卡片 */}
      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-500">
        <div className="text-sm text-gray-900 dark:text-gray-100 space-y-2 font-mono">
          <div className="font-bold text-base mb-2">🐛 实时调试信息</div>
          <div>weekData.length: <span className="font-bold text-red-600">{weekData.length}</span></div>
          <div>monthData.length: <span className="font-bold text-red-600">{monthData.length}</span></div>
          <div>todayDuration: <span className="font-bold text-red-600">{todayDuration}</span></div>
          <div>weekData 有数据天数: <span className="font-bold text-red-600">{weekData.filter(d => d.minutes > 0).length}</span></div>
          <div className="pt-2 border-t border-red-300">
            <div className="text-xs">weekData 前3天:</div>
            {weekData.slice(0, 3).map(d => (
              <div key={d.date} className="text-xs ml-2">
                {d.date}: {d.minutes}分钟
              </div>
            ))}
          </div>
        </div>
      </div>

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
