// 番茄钟状态
export interface PomodoroState {
  isRunning: boolean;
  timeLeft: number; // 剩余时间（秒）
  mode: 'study' | 'break'; // 学习或休息模式
  studyDuration: number; // 学习时长（秒）
  breakDuration: number; // 休息时长（秒）
  completedPomodoros: number; // 今日完成的番茄钟数
}

// 学习日志
export interface StudyLog {
  id: string;
  date: string; // ISO格式
  duration: number; // 学习时长（分钟）
  content: string; // Markdown内容
  tags: string[]; // 标签
  knowledgePoints: string[]; // 知识点
  createdAt: number; // 时间戳
  updatedAt: number; // 时间戳
}

// Streak状态
export interface StreakState {
  currentStreak: number; // 当前连续天数
  longestStreak: number; // 最长连续记录
  lastStudyDate: string; // 上次学习日期
  totalStudyDays: number; // 总学习天数
}

// 技能节点
export interface SkillNode {
  id: string;
  name: string;
  description: string;
  category: 'Unity' | 'C#' | '算法' | '图形学' | '其他';
  status: 'locked' | 'available' | 'in-progress' | 'completed';
  prerequisites: string[]; // 前置技能ID
  estimatedTime: number; // 预计学习时长（小时）
  progress: number; // 进度 0-100
}

// 技能树状态
export interface SkillTreeState {
  nodes: SkillNode[];
  completedCount: number;
  totalCount: number;
}

// 设置
export interface Settings {
  studyDuration: number; // 默认25分钟
  breakDuration: number; // 默认5分钟
  longBreakDuration: number; // 长休息15分钟
  pomodorosUntilLongBreak: number; // 几个番茄钟后长休息
  soundEnabled: boolean; // 是否开启音效
  notificationEnabled: boolean; // 是否开启通知
}

// 统计数据
export interface Statistics {
  today: number; // 今日学习时长（分钟）
  thisWeek: number; // 本周学习时长
  thisMonth: number; // 本月学习时长
  total: number; // 总学习时长
  dailyData: { date: string; duration: number }[]; // 每日数据
}
