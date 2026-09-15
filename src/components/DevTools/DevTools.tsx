import { useState } from 'react';

export default function DevTools() {
  const [isOpen, setIsOpen] = useState(false);

  // 只在开发环境显示
  const isDev = import.meta.env.DEV;

  console.log('DevTools 环境检测:', {
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    MODE: import.meta.env.MODE,
    shouldShow: isDev
  });

  if (!isDev) return null;

  // 生成随机学习数据（过去7天）
  const generateMockData = (days: number) => {
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // 随机生成 25-150 分钟的学习时长
      const duration = Math.floor(Math.random() * 126) + 25;

      localStorage.setItem(
        `learning-assistant:log:${dateStr}`,
        JSON.stringify({ duration, content: `模拟数据 - 第${i + 1}天` })
      );
    }

    alert(`✅ 已生成 ${days} 天的模拟数据！刷新页面查看效果。`);
    window.location.reload();
  };

  // 清空所有数据
  const clearAllData = () => {
    if (!confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) return;

    // 清空所有 learning-assistant 相关的数据
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('learning-assistant:')) {
        localStorage.removeItem(key);
      }
    });

    alert('✅ 所有数据已清空！');
    window.location.reload();
  };

  // 添加今日学习记录
  const addTodayDuration = (minutes: number) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `learning-assistant:log:${today}`;
    const existing = localStorage.getItem(key);

    const currentDuration = existing ? JSON.parse(existing).duration : 0;
    const newDuration = currentDuration + minutes;

    localStorage.setItem(
      key,
      JSON.stringify({ duration: newDuration, content: '测试数据' })
    );

    alert(`✅ 已添加 ${minutes} 分钟，今日总计: ${newDuration} 分钟`);
    window.location.reload();
  };

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-xl flex items-center justify-center text-2xl transition-transform hover:scale-110 border-2 border-purple-400"
        title="开发者工具 (仅开发环境)"
      >
        🛠️
      </button>

      {/* 工具面板 */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[9999] w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 border-2 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400">
              🛠️ 开发者工具
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* 生成模拟数据 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                生成模拟数据
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => generateMockData(7)}
                  className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition"
                >
                  7天
                </button>
                <button
                  onClick={() => generateMockData(14)}
                  className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition"
                >
                  14天
                </button>
                <button
                  onClick={() => generateMockData(30)}
                  className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition"
                >
                  30天
                </button>
              </div>
            </div>

            {/* 添加今日学习时长 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                添加今日学习时长
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => addTodayDuration(25)}
                  className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition"
                >
                  +25分钟
                </button>
                <button
                  onClick={() => addTodayDuration(50)}
                  className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition"
                >
                  +50分钟
                </button>
                <button
                  onClick={() => addTodayDuration(100)}
                  className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition"
                >
                  +100分钟
                </button>
              </div>
            </div>

            {/* 清空数据 */}
            <button
              onClick={clearAllData}
              className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition"
            >
              🗑️ 清空所有数据
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            💡 此面板仅在开发环境显示
          </p>
        </div>
      )}
    </>
  );
}
