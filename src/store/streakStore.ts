import { create } from 'zustand';
import { getStorageItem, setStorageItem, STORAGE_KEYS, getTodayDate, daysBetween } from '../utils/storage';

interface StreakState {
  currentStreak: number; // 当前连续天数
  longestStreak: number; // 最长连续天数
  lastStudyDate: string | null; // 最后学习日期 YYYY-MM-DD
  totalDays: number; // 总学习天数
}

interface StreakStore extends StreakState {
  // 加载Streak数据
  loadStreak: () => void;

  // 更新学习记录（每天第一次学习时调用）
  updateStreak: () => void;

  // 重置Streak（用于测试或清空数据）
  resetStreak: () => void;

  // 检查是否今天已学习
  hasStudiedToday: () => boolean;
}

const INITIAL_STATE: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  totalDays: 0,
};

export const useStreakStore = create<StreakStore>((set, get) => ({
  ...INITIAL_STATE,

  loadStreak: () => {
    const data = getStorageItem<StreakState>(STORAGE_KEYS.STREAK, INITIAL_STATE);
    set(data);
  },

  updateStreak: () => {
    const today = getTodayDate();
    const { lastStudyDate, currentStreak, longestStreak, totalDays } = get();

    // 今天已经更新过了
    if (lastStudyDate === today) {
      return;
    }

    let newCurrentStreak = currentStreak;
    let newTotalDays = totalDays + 1;

    if (!lastStudyDate) {
      // 第一次学习
      newCurrentStreak = 1;
    } else {
      const daysDiff = daysBetween(lastStudyDate, today);

      if (daysDiff === 1) {
        // 连续学习
        newCurrentStreak += 1;
      } else if (daysDiff > 1) {
        // 断签了，重新开始
        newCurrentStreak = 1;
      }
      // daysDiff === 0 不应该发生（因为上面已经检查过了）
    }

    const newLongestStreak = Math.max(longestStreak, newCurrentStreak);

    const newState: StreakState = {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastStudyDate: today,
      totalDays: newTotalDays,
    };

    set(newState);
    setStorageItem(STORAGE_KEYS.STREAK, newState);
  },

  resetStreak: () => {
    set(INITIAL_STATE);
    setStorageItem(STORAGE_KEYS.STREAK, INITIAL_STATE);
  },

  hasStudiedToday: () => {
    return get().lastStudyDate === getTodayDate();
  },
}));
