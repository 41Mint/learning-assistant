# 前端样式与交互约定

页面和浮层沿用应用的明暗主题。颜色、边框和交互动效从 `--app-*` 变量取值。通用输入框和操作按钮使用 `.workspace-input` 与 `.workspace-button`。输入和按钮并排时，对齐控件底边，由同一处定义控件高度，并在窄屏检查长文本和禁用状态。[全局样式](../src/index.css)

## 滚动条

页面、编辑框和选项列表里的滚动区域沿用全局细滚动条、透明轨道和 `--app-scrollbar-thumb`。长选项列表在弹层内滚动。系统强制配色时沿用系统滚动条。[全局样式](../src/index.css)

## 聚焦与键盘操作

文本框、下拉框和多行输入聚焦时用主题强调色边框和浅色光晕。标签要与控件关联。词条列表、知识网络目录及智能体建议卡片在悬停或键盘聚焦时用主题强调色标出标题。[全局样式](../src/index.css)

- **筛选、分段切换、工具栏图标和描边操作链接**。悬停及 `:focus-visible` 使用内侧细描边，保留控件原有底色和文字颜色。选中状态用固定底色表示，禁用按钮沿用禁用样式。
- **原位辅助按钮**。导入图文学习记录、选择任务等 `.workspace-button` 用底色和文字颜色反馈悬停及键盘聚焦，保留静态边框。系统强制配色下使用可见的焦点轮廓。
- **实底主次按钮**。`.note-button` 保留操作层级的实底配色，键盘聚焦时用高对比细描边。
- **详情操作行**。日志、词条和代码版本的主按钮及描边链接共用 `--app-detail-action-height`，按行居中，窄屏允许换行。导入按钮继续靠左，文字操作按原有文字样式显示。

分别检查悬停、Tab 聚焦、选中与禁用状态，并在有裁切的区域检查焦点提示是否完整。[全局样式](../src/index.css)

日志标签支持双击原位编辑，触屏轻点或键盘激活也可进入。Enter 保存，Esc 或点开其他区域取消，保存或按 Esc 后焦点回到标签。[日志标签](../src/components/StudyLog/LogMetadataField.tsx)

## 展开与收起

普通折叠区可用 `details` 和 `summary`，沿用全局双向过渡。添加、编辑任务和项目代码等原位表单复用 `InlineReveal`，用 `aria-expanded` 表示状态。收起时立即让内部控件退出键盘焦点顺序，并把焦点交还触发按钮，过渡结束后卸载表单。时长和缓动使用 `--app-motion-duration` 与 `--app-motion-ease`。系统开启减少动态效果时，时长为零。[通用展开组件](../src/components/common/InlineReveal.tsx) · [全局样式](../src/index.css)

## 下拉列表与关键词筛选

- **固定选项**用原生 `select`。支持 `::picker(select)` 的浏览器用全局主题装饰列表，保留原生键盘和选择行为。其余浏览器与系统强制配色模式使用原生下拉面板。[Chrome 开发文档](https://developer.chrome.com/docs/modern-web-guidance/guides/forms/branded-select-styling)
- **可筛选或可新增的选项**用 `SearchableSelect`，例如词条分类筛选和参考主题领域。打开候选时可逐条浏览，输入后即时筛选。支持鼠标选择、方向键移动、Enter 确认和 Esc 关闭。固定候选的筛选文字和已选项分开保存。自填模式适合需要新增分类或领域的表单。
- **浮层样式**。面板靠近触发控件展开。关键词筛选列表与控件同宽，紧凑的固定选项菜单可以按文字宽度加宽，空间不足时调整展开方向。用视口约束菜单尺寸，给长名称留出换行空间和选中标记位置。浮层使用主题表面、圆角、限高和细滚动条。Esc 优先关闭最内层浮层。验收覆盖明暗主题、窄屏、弹窗和全屏画布。
- **文字筛选**。实时搜索和筛选输入设 `autoComplete="off"`。应用需要展示候选时使用同一套带定位和键盘操作的列表。
- **多选资料**用 `ReferenceChoices`。筛选只影响当前显示的选项，其他已勾选的选项继续保留。
- 复用 `searchWords` 和 `matchesWords`。空格分隔的词须全部匹配，可分布在不同搜索字段。日志可按日期、标题、标签、知识点或正文筛选。测试时覆盖空输入、无匹配、键盘确认以及选择后执行操作。

[单选组件](../src/components/common/SearchableSelect.tsx) · [多选组件](../src/components/common/ReferenceChoices.tsx) · [检索规则](../src/utils/resourceSearch.ts)

## 代码显示

代码块、项目快照与正文引用预览统一使用基于 [One Monokai](https://github.com/azemoh/vscode-one-monokai) 的 Highlight.js 颜色和本地打包的 [Fira Code](https://github.com/tonsky/FiraCode) 网页字体。代码区域保持同一套配色，不改变应用明暗主题。代码引用可用鼠标或 Tab 预览，也可直接激活链接跳转。
