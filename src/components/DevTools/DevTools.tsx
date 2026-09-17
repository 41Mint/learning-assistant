import { useState, useRef, useEffect } from 'react';

export default function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 只在开发环境显示
  const isDev = import.meta.env.DEV;

  // 鼠标按下开始拖动
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  // 鼠标移动
  useEffect(() => {
    if (!isDev) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 320));
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 100));
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDev, isDragging, dragOffset]);

  if (!isDev) return null;

  // 生成随机学习数据
  const generateMockData = (days: number) => {
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

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

  // 查看所有学习数据（调试用）
  const debugAllData = () => {
    console.clear();
    console.log('=== 🔍 Learning Assistant 数据调试 ===\n');

    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('learning-assistant:log:'));
    console.log(`📦 总共 ${allKeys.length} 条学习记录\n`);

    allKeys.sort().forEach(key => {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      console.log(`${key.replace('learning-assistant:log:', '')} → ${data.duration || 0} 分钟`);
    });

    // 检查本周数据
    console.log('\n📅 本周数据（最近7天）:');
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const key = `learning-assistant:log:${dateStr}`;
      const data = localStorage.getItem(key);
      const duration = data ? JSON.parse(data).duration : 0;
      console.log(`  ${dateStr} → ${duration} 分钟 ${duration === 0 ? '❌' : '✅'}`);
    }

    alert('📊 调试数据已输出到控制台（按 F12 查看）');
  };

  return (
    <>
      {/* 浮动按钮 - 放大到 96px */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 999999
        }}
        className="w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white rounded-full shadow-2xl flex items-center justify-center text-6xl transition-all hover:scale-110 border-4 border-purple-300"
        title="开发者工具 (可拖动)"
      >
        🛠️
      </button>

      {/* 可拖动的工具面板 - 放大到 400px */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 999998,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
          onMouseDown={handleMouseDown}
          className="w-[400px] rounded-xl shadow-2xl border-2 border-purple-500 overflow-hidden bg-white dark:bg-gray-800"
        >
          {/* 标题栏 - 可拖动区域，更大字体 */}
          <div className="drag-handle bg-gradient-to-r from-purple-600 to-purple-700 p-4 cursor-grab active:cursor-grabbing select-none">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                🛠️ 开发者工具
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 w-9 h-9 rounded-full flex items-center justify-center transition text-xl"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 面板内容 - 更大的字体和按钮 */}
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 生成模拟数据 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
                📊 生成模拟数据
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => generateMockData(7)}
                  className="flex-1 px-5 py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg rounded-lg transition font-medium"
                >
                  7天
                </button>
                <button
                  onClick={() => generateMockData(14)}
                  className="flex-1 px-5 py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg rounded-lg transition font-medium"
                >
                  14天
                </button>
                <button
                  onClick={() => generateMockData(30)}
                  className="flex-1 px-5 py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg rounded-lg transition font-medium"
                >
                  30天
                </button>
              </div>
            </div>

            {/* 添加今日学习时长 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
                ⏱️ 添加今日学习时长
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => addTodayDuration(25)}
                  className="flex-1 px-5 py-4 bg-green-500 hover:bg-green-600 text-white text-lg rounded-lg transition font-medium"
                >
                  +25分钟
                </button>
                <button
                  onClick={() => addTodayDuration(50)}
                  className="flex-1 px-5 py-4 bg-green-500 hover:bg-green-600 text-white text-lg rounded-lg transition font-medium"
                >
                  +50分钟
                </button>
                <button
                  onClick={() => addTodayDuration(100)}
                  className="flex-1 px-5 py-4 bg-green-500 hover:bg-green-600 text-white text-lg rounded-lg transition font-medium"
                >
                  +100分钟
                </button>
              </div>
            </div>

            {/* 调试工具 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
                🔍 调试工具
              </p>
              <button
                onClick={debugAllData}
                className="w-full px-6 py-4 bg-yellow-500 hover:bg-yellow-600 text-white text-lg rounded-lg transition font-medium"
              >
                📊 查看所有数据 (控制台)
              </button>
            </div>

            {/* 清空数据 */}
            <button
              onClick={clearAllData}
              className="w-full px-6 py-4 bg-red-500 hover:bg-red-600 text-white text-lg rounded-lg transition font-medium"
            >
              🗑️ 清空所有数据
            </button>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
              💡 仅开发环境 | 抓住标题栏拖动面板
            </p>
          </div>
        </div>
      )}
    </>
  );
}
