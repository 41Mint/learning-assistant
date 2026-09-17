# 架构设计

## 总体架构

本项目采用经典的React单页应用架构，数据流采用单向数据流模式。

```
┌─────────────────────────────────────────┐
│           User Interface                │
│  (React Components + Tailwind CSS)      │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│        State Management                 │
│           (Zustand)                     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│      Data Persistence Layer             │
│         (LocalStorage)                  │
└─────────────────────────────────────────┘
```

## 核心模块

### 1. 番茄钟模块（Pomodoro）

**职责**：
- 计时控制（开始、暂停、重置）
- 学习/休息模式切换
- 时间提醒

**数据结构**：
```typescript
interface PomodoroState {
  isRunning: boolean;
  timeLeft: number; // 秒
  mode: 'study' | 'break';
  studyDuration: number; // 默认25分钟
  breakDuration: number; // 默认5分钟
}
```

### 2. 学习记录模块（Study Log）

**职责**：
- 记录每日学习内容
- 支持Markdown格式
- 计算学习时长
- 连续学习天数统计

**数据结构**：
```typescript
interface StudyLog {
  id: string;
  date: string; // ISO格式日期
  duration: number; // 分钟
  content: string; // Markdown内容
  tags: string[]; // 标签（如"Unity", "C#", "算法"）
  knowledgePoints: string[]; // 学到的知识点
}

interface StreakState {
  currentStreak: number; // 当前连续天数
  longestStreak: number; // 最长连续天数
  lastStudyDate: string;
}
```

### 3. 技能树模块（Skill Tree）

**职责**：
- 展示学习路径
- 记录完成状态
- 解锁新技能

**数据结构**：
```typescript
interface SkillNode {
  id: string;
  name: string;
  description: string;
  category: 'Unity' | 'C#' | '算法' | '图形学' | '其他';
  status: 'locked' | 'available' | 'completed';
  prerequisites: string[]; // 前置技能ID
  estimatedTime: number; // 预计学习时长（小时）
}

interface SkillTree {
  nodes: SkillNode[];
  completedCount: number;
}
```

**实现约定**：预设路径定义与 UI 分离，持久化数据仅保存 `completedIds`。节点的锁定、可用和完成状态由前置条件实时推导，避免将可计算状态写入 LocalStorage 后产生不一致。

### 3.1 当前学习目标（Current Goal）

**职责**：保存用户当前聚焦的已解锁技能节点，为番茄钟与日志提供轻量的学习上下文。

**边界**：当前目标只会在番茄钟完成时作为标签写入当天学习日志；不会自动将学习时长等同于技能掌握，也不会自动完成技能节点。未来 AI 总结可在此上下文上补充内容提炼和归类。

### 4. 统计模块（Statistics）

**职责**：
- 计算学习数据
- 生成图表数据

**指标**：
- 今日学习时长
- 本周学习时长
- 本月学习时长
- 总学习时长
- 连续学习天数

## 数据持久化

### LocalStorage结构

```typescript
// 存储键名
const STORAGE_KEYS = {
  STUDY_LOGS: 'learning-assistant:study-logs',
  SKILL_TREE: 'learning-assistant:skill-tree',
  CURRENT_GOAL: 'learning-assistant:current-goal',
  STREAK: 'learning-assistant:streak',
  SETTINGS: 'learning-assistant:settings',
} as const;
```

### 数据迁移策略

当需要改变数据结构时：
1. 添加版本号字段
2. 编写迁移函数
3. 应用启动时检查版本并迁移

当前还兼容读取早期开发工具生成的 `learning-assistant:log:YYYY-MM-DD` 记录：首次加载时仅将缺失日期复制到正式学习日志，不覆盖或删除原数据。

```typescript
interface StorageData {
  version: number;
  data: any;
}
```

## 状态管理（Zustand）

采用分片管理，每个模块独立store：

```typescript
// 番茄钟store
const usePomodoroStore = create<PomodoroState>((set) => ({...}));

// 学习日志store
const useStudyLogStore = create<StudyLogState>((set) => ({...}));

// 技能树store
const useSkillTreeStore = create<SkillTreeState>((set) => ({...}));
```

## 组件设计原则

1. **单一职责**：每个组件只负责一个功能
2. **可复用性**：通用组件放在`components/common/`
3. **TypeScript严格模式**：所有props和state都有类型定义
4. **可测试性**：逻辑与UI分离，便于单元测试

## 未来扩展点

1. **AI推荐系统**：
   - 接入GPT API
   - 根据学习日志分析知识点
   - 推荐下一步学习内容

2. **云端同步**：
   - 后端API设计
   - 数据加密
   - 冲突解决策略

3. **社交功能**：
   - 学习打卡分享
   - 好友互相督促
