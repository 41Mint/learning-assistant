# 本地安装、启动与验证

## 启动

安装 Git 和 Node.js 24，从 GitHub 克隆项目，或下载最新 ZIP 并解压。在项目目录中双击 Windows 的 `start.bat` 或 macOS 的 `start.command`。启动器会检查 `origin/master`、按需安装依赖，并打开 [本地学习助手](http://localhost:5185)。使用时保持终端窗口运行。若 macOS 提示确认打开下载的文件，可核对来源后按系统提示操作。[Apple 的打开说明](https://support.apple.com/en-us/102445)

组员从最新已推送的 ZIP 启动时，启动器在解压目录内建立 `learning-assistant-local` 作为运行和更新副本，以后仍可双击原目录的启动文件。直接从 Git 克隆目录启动时，运行和更新在该目录内进行。在终端中可用 `npm run dev:latest` 运行同样的流程。

更新前先退出旧的开发服务。启动器遇到已跟踪文件的本地修改、分支分叉或网络错误时会提示原因。开发本地改动或需要手动启动时，在要运行的项目目录执行以下命令。依赖已安装且锁文件未变化时可直接启动。

```bash
npm ci
npm run dev -- --port 5185 --strictPort
```

个人数据保存在当前浏览器的站点数据中。继续用同一个浏览器访问 `http://localhost:5185` 可沿用原有记录。换设备、浏览器或端口前，可从「数据管理」导出完整备份。依赖、构建产物和浏览器测试输出分别位于 `node_modules/`、`dist/` 和 `test-results/`，由 Git 忽略。

## 配置 DeepSeek

1. 在 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建 API Key，确认账户有可用余额。
2. 在实际运行的项目根目录复制 `.env.example` 为 `.env.local`。如已有 `.env.local`，补充对应字段即可。从 ZIP 启动时，把配置放在运行和更新副本内。

   ```dotenv
   DEEPSEEK_API_KEY=在这里填写本机密钥
   DEEPSEEK_MODEL=deepseek-flash
   ```

   密钥只保存在本机的 `.env.local`，由服务端读取。模型字段可省略，默认使用 `deepseek-flash`。
3. 停止并重启本地服务，打开一篇日志的编辑表单，使用学习智能体试一次整理。更完整的用例见 [学习智能体验收](./LOG_REVIEW_ACCEPTANCE.md#验收用例)。

## 进入测试工作区

开发环境下，在页面右下角点击「开发者工具」→「进入测试工作区」。新标签页会显示「测试工作区」，使用与个人工作区隔离的样例资料。测试修改保存在当前浏览器，从开发者工具选择「恢复示例数据」即可重新开始。操作和预期结果见 [组员验收步骤](./TEST_WORKSPACE_ACCEPTANCE.md#验收顺序)。

## 开发验证

```bash
npm run lint
npm run build
npm run test:e2e
```

浏览器测试使用独立的 5187 端口和隔离的浏览器数据。Windows 使用本机 Edge，其他平台先执行 `npx playwright install chromium`。可把用例文件作为参数传给 `npm run test:e2e --`，各功能的验收指南列有对应文件。实际学习材料用例可选传入 `DAY1_NOTE`、`UNITY_SCRIPT_SAMPLE` 和 `UNITY_CODE_PERMALINK`，分别指向日志 Markdown、本地 C# 脚本和固定提交链接。

如需演示构建产物，运行 `npm run build` 后执行 `npm run preview -- --port 5185 --strictPort`。
