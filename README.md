# Learning Assistant - 学习助手

一个帮助游戏开发学习者保持学习动力和记录学习进度的Web应用。

## 项目概览

这是一个为自驱力不强的学习者设计的督促与激励工具，通过游戏化机制（技能树、连续学习天数、成就系统）来帮助用户建立持续学习的习惯。

## 核心功能

### MVP阶段（当前）
- [ ] 番茄钟计时器（25分钟学习 + 5分钟休息）
- [ ] 每日学习时长记录
- [ ] 连续学习天数（Streak）
- [ ] 学习日志（Markdown格式，支持代码、截图）
- [ ] 简单的技能树/任务列表

### 后续计划
- [ ] 学习内容AI推荐（基于已学内容）
- [ ] 统计图表（周/月学习时长可视化）
- [ ] 成就系统
- [ ] 代码片段库
- [ ] 资源收藏管理
- [ ] 云端数据同步

## 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **图表**: Recharts
- **Markdown渲染**: react-markdown
- **数据持久化**: LocalStorage（未来计划云端同步）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 使用固定端口启动（推荐，浏览器访问 http://localhost:5185）
npm run dev -- --port 5185

# 构建生产版本
npm run build
```

## 本地预览说明

本项目当前使用 Vite 本地开发服务器，并未部署为持续在线的网站。启动命令所在的终端或 Codex 任务关闭、系统休眠或重启后，服务器会停止，`localhost:5185` 也会暂时无法访问；重新运行固定端口命令即可恢复。

## 项目结构

```
src/
├── components/        # 可复用组件
│   ├── Pomodoro/     # 番茄钟组件
│   ├── SkillTree/    # 技能树组件
│   └── StudyLog/     # 学习日志组件
├── store/            # Zustand状态管理
├── types/            # TypeScript类型定义
├── utils/            # 工具函数
└── App.tsx           # 主应用组件
```

## 开发理念

- **简洁实用优先**：轻度游戏化，避免过度设计
- **灵活可调整**：支持自定义每日学习流程
- **记录成长**：详细的学习日志帮助回顾和总结
- **持续迭代**：根据实际使用体验不断优化
- **生成式软件工程实践**：以“意图 → 可验收规格 → 实现 → 验证”的小步闭环与 AI 协作，详见 [ENGINEERING_PLAYBOOK.md](./ENGINEERING_PLAYBOOK.md)

## 版本历史

查看 [CHANGELOG.md](./CHANGELOG.md)

## License

MIT
