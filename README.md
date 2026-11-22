# Learning Assistant · 学习助手

面向游戏开发学习者的本地 Web 应用。用番茄钟和学习任务安排今天的学习，把图文笔记、知识词条、代码版本和实践记录串起来，方便日后回查。

## 本地启动

安装 Node.js 24 后，在项目根目录运行以下命令。

```bash
npm ci
npm run dev -- --port 5185 --strictPort
```

保持终端运行，打开 [本地学习助手](http://localhost:5185)。组员试用时，从右下角「开发者工具」进入测试工作区。这里有预填样例，可以恢复示例数据。使用真实模型时，先配置本机 DeepSeek。[测试工作区验收](./docs/TEST_WORKSPACE_ACCEPTANCE.md) · [DeepSeek 配置](./docs/LOG_REVIEW_ACCEPTANCE.md#配置-deepseek)

个人数据保存在当前浏览器与端口下。换设备、浏览器或端口前，可以从「数据管理」导出完整备份。

组员可以用 Git 克隆一次项目，以后通过 `npm run dev:latest` 同步更新并打开本地学习助手。Windows 和 macOS 使用同一命令。[自动更新启动步骤](./docs/TEST_WORKSPACE_ACCEPTANCE.md#启动时自动更新)

## 文档入口

| 想做什么 | 查看 |
| --- | --- |
| 上手或给试用反馈 | [使用指南](./docs/USER_GUIDE.md) · [组员验收步骤](./docs/TEST_WORKSPACE_ACCEPTANCE.md) |
| 看最近改动 | [更新日志](./CHANGELOG.md) |
| 验证某个功能 | [图文日志](./docs/GRAPHIC_NOTES_ACCEPTANCE.md) · [知识词条与网络](./docs/KNOWLEDGE_ACCEPTANCE.md) · [成长记录](./docs/GROWTH_ACCEPTANCE.md) · [项目代码](./docs/PROJECT_CODE_ACCEPTANCE.md) · [学习智能体](./docs/LOG_REVIEW_ACCEPTANCE.md) |
| 继续开发 | [架构设计](./docs/ARCHITECTURE.md) · [前端样式与交互约定](./docs/FRONTEND_GUIDE.md) · [工程协作约定](./docs/ENGINEERING_PLAYBOOK.md) · [待办事项](./docs/TODO.md) |

[早期开发资料](./docs/archive)保留了开发日志、功能清单和初版项目指南。

## 开发验证

```bash
npm run lint
npm run build
npm run test:e2e
```

浏览器测试使用独立的 5187 端口及隔离数据。Windows 使用本机 Edge，其他系统可先执行 `npx playwright install chromium`。实际学习材料用例可选传入 `DAY1_NOTE`、`UNITY_SCRIPT_SAMPLE` 和 `UNITY_CODE_PERMALINK`，对应日志 Markdown、本地 C# 文件和固定提交链接。

## 许可证

MIT
