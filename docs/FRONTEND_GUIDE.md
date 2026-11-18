# 前端样式与交互约定

页面和浮层沿用应用的明暗主题。颜色、边框和交互动效从 `--app-*` 变量取值。通用输入框和操作按钮使用 `.workspace-input` 与 `.workspace-button`。输入和按钮并排时，对齐控件底边，由同一处定义控件高度，并在窄屏检查长文本和禁用状态。[全局样式](../src/index.css)

## 滚动条

页面、编辑框和选项列表里的滚动区域沿用全局细滚动条、透明轨道和 `--app-scrollbar-thumb`。弹出的原生选择列表由浏览器或系统绘制。资料选择需要关键词筛选或统一滚动条样式时，复用应用内带滚动容器的选择器。系统强制配色时沿用系统滚动条。[全局样式](../src/index.css) · [SearchableSelect](../src/components/common/SearchableSelect.tsx)

## 聚焦与键盘操作

文本框、下拉框和多行输入沿用主题强调色边框和浅色光晕。按钮、链接和可聚焦区域共用 `:focus-visible` 的主题色细轮廓和浅色内光晕，侧栏等带裁切的区域也能显示完整的焦点提示。标签要与控件关联。关闭原位表单后将焦点交还打开它的按钮，便于继续用键盘操作。[全局样式](../src/index.css) · [代码表单展开示例](../src/components/ProjectCode/CodeFormReveal.tsx)

## 展开与收起

普通折叠区可用 `details` 和 `summary`，沿用全局双向过渡。自定义折叠区用 `aria-expanded` 表示当前状态，收起时让内部控件退出键盘焦点顺序。收起过渡完成后再卸载需要清空草稿的表单。时长和缓动使用 `--app-motion-duration` 与 `--app-motion-ease`。系统开启减少动态效果时，时长为零。[全局样式](../src/index.css) · [日志整理示例](../src/components/StudyLog/LogReviewPanel.tsx)

## 逐条浏览与关键词筛选

- **单选资料**用 `SearchableSelect`。输入为空时可逐条浏览，输入词后即时筛选。支持鼠标选择、方向键移动、Enter 确认和 Esc 关闭。筛选文字和已选资料分开保存，选中时使用资料 ID。
- **多选资料**用 `ReferenceChoices`。筛选只影响当前显示的选项，其他已勾选的选项继续保留。
- 复用 `searchWords` 和 `matchesWords`。空格分隔的词须全部匹配，可分布在不同搜索字段。日志可按日期、标题、标签、知识点或正文筛选。测试时覆盖空输入、无匹配、键盘确认以及选择后执行操作。

[单选组件](../src/components/common/SearchableSelect.tsx) · [多选组件](../src/components/common/ReferenceChoices.tsx) · [检索规则](../src/utils/resourceSearch.ts)
