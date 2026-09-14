import { useEffect } from 'react';
import { useStreakStore } from '../../store/streakStore';

export default function Streak() {
  const {
    currentStreak,
    longestStreak,
    totalDays,
    loadStreak,
    updateStreak,
    hasStudiedToday,
  } = useStreakStore();

  useEffect(() => {
    loadStreak();
  }, []);

  // 获取火焰图标数量（最多5个）
  const getFlameCount = () => {
    if (currentStreak === 0) return 0;
    if (currentStreak < 3) return 1;
    if (currentStreak < 7) return 2;
    if (currentStreak < 14) return 3;
    if (currentStreak < 30) return 4;
    return 5;
  };

  const flames = '🔥'.repeat(getFlameCount());

  // 获取鼓励文本
  const getMotivationText = () => {
    if (currentStreak === 0) {
      return '开始你的学习之旅！';
    }
    if (currentStreak < 3) {
      return '不错的开始！';
    }
    if (currentStreak < 7) {
      return '继续保持！';
    }
    if (currentStreak < 14) {
      return '你很有毅力！';
    }
    if (currentStreak < 30) {
      return '坚持就是胜利！';
    }
    if (currentStreak < 100) {
      return '你太厉害了！';
    }
    return '传奇级坚持！';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        🔥 连续学习
      </h2>

      {/* 当前连续天数 */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">{flames || '🌱'}</div>
        <div className="text-5xl font-bold text-orange-500 dark:text-orange-400 mb-2">
          {currentStreak}
        </div>
        <div className="text-gray-600 dark:text-gray-400 text-lg mb-2">
          连续学习天数
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          {getMotivationText()}
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {longestStreak}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            最长连续
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {totalDays}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            累计天数
          </div>
        </div>
      </div>

      {/* 今日状态 */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            今日状态
          </span>
          {hasStudiedToday() ? (
            <span className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
              <span className="text-xl">✓</span>
              已打卡
            </span>
          ) : (
            <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold">
              <span className="text-xl">⏰</span>
              待打卡
            </span>
          )}
        </div>
      </div>

      {/* 提示信息 */}
      {!hasStudiedToday() && currentStreak > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            💡 完成一个番茄钟即可打卡！不要让 {currentStreak} 天的努力断签哦～
          </p>
        </div>
      )}
    </div>
  );
}
