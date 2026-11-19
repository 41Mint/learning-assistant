import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectCodeData } from '../src/types/projectCode';
import type { ChatRequest } from '../src/types/assistantChat';

const firstDate = '2026-11-02';
const scriptPath = 'Assets/Scripts/InputManager.cs';
const repository = 'https://github.com/learning-demo/mole';
const permalink = repository + '/blob/0123456789abcdef0123456789abcdef01234567/' + scriptPath;
const firstContent = 'public class InputManager {\n  private int hits = 1;\n}\n/*\n~~~\n![示例](https://example.com/unexpected.png)\n*/\n';
const secondContent = 'public class InputManager {\n  private int hits = 2;\n}\n';

async function seedStudyContext(page: Page) {
  await page.addInitScript(({ date }) => {
    if (localStorage.getItem('project-code-test-seeded')) return;
    localStorage.setItem('project-code-test-seeded', '1');
    localStorage.setItem('learning-assistant:study-logs', JSON.stringify([
      { id: 'code-log', date, content: '# 点击判断笔记', tags: [], knowledgePoints: [], duration: 25, createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('learning-assistant:knowledge', JSON.stringify({
      version: 1,
      entries: [{ id: 'code-entry', title: '点击判断', aliases: [], category: '', content: '', createdAt: 1, updatedAt: 1 }],
      logLinks: [], relations: [],
    }));
    localStorage.setItem('learning-assistant:growth', JSON.stringify({
      version: 1,
      outcomes: [{ id: 'click-outcome', title: '点击目标时增加分数', domains: ['Unity', 'C#'], practices: [
        { id: 'first-practice', date, note: '第一次实现点击', logIds: ['code-log'], entryIds: ['code-entry'] },
        { id: 'second-practice', date: '2026-11-03', note: '第二次调整判断', logIds: [], entryIds: [] },
      ] }],
    }));
  }, { date: firstDate });
}

async function openLogCodeForm(page: Page, count = 0) {
  const panel = page.getByRole('region', { name: '项目代码', exact: true });
  await panel.getByText('项目代码（' + count + '）', { exact: true }).click();
  await panel.getByRole('button', { name: '添加代码版本', exact: true }).click();
  return { panel, form: panel.getByRole('form', { name: '保存代码版本' }) };
}

async function downloadBackup(page: Page) {
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '数据管理' }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  const download = await event;
  return JSON.parse(await readFile((await download.path())!, 'utf8'));
}

test('智能体从历史实践定位关联代码，确认目标后沿用番茄钟与备份', async ({ page, browser }) => {
  await seedStudyContext(page);
  await page.goto('/#history/' + firstDate);
  const { form } = await openLogCodeForm(page);
  await form.getByLabel('项目名称').fill('打地鼠');
  await form.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(secondContent) });
  await form.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(form).toBeHidden();
  const code = await page.evaluate(async () => {
    const { readProjectCode } = await import('/src/utils/projectCodeStorage.ts');
    return readProjectCode();
  }) as ProjectCodeData;
  const version = code.versions[0];
  await page.evaluate((versionId) => {
    const key = 'learning-assistant:growth';
    const stored = JSON.parse(localStorage.getItem(key)!);
    stored.outcomes[0].practices[0].codeVersionIds = [versionId];
    localStorage.setItem(key, JSON.stringify(stored));
    localStorage.setItem('learning-assistant:current-goal', JSON.stringify({ version: 2, goal: { id: 'unity-foundations', type: 'skill', label: '原目标' } }));
  }, version.id);
  await page.reload();
  await page.goto('/#today');
  const launcher = page.getByRole('button', { name: '打开学习智能体' });
  const restore = page.getByRole('button', { name: '恢复学习智能体' });
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await launcher.click();
  const question = assistant.getByRole('textbox', { name: '输入问题' });
  await question.fill('上次我怎么实现点击目标的？');
  await question.press('Enter');
  const query = assistant.getByRole('textbox', { name: '查找实践' });
  await expect(query).toHaveValue('点击目标');
  await expect(assistant.getByRole('button', { name: /点击目标时增加分数/ })).toHaveCount(2);
  await query.fill('没有这项成果');
  await expect(assistant.getByRole('status')).toContainText('没有找到匹配');
  await query.fill('hits');
  await assistant.getByRole('button', { name: /点击目标时增加分数.*2026-11-02/ }).click();
  await expect(assistant.getByRole('link', { name: /日志 ·.*点击判断笔记/ })).toBeVisible();
  await expect(assistant.getByRole('link', { name: '词条 · 点击判断' })).toBeVisible();
  await assistant.getByRole('link', { name: /InputManager\.cs.*第 2 行/ }).click();
  await expect(page).toHaveURL(/#code\/.+\?find=hits&source=1$/);
  await expect(page.getByText('命中第 2 行', { exact: true })).toBeVisible();
  await restore.click();
  await assistant.getByRole('button', { name: '设为当前目标', exact: true }).click();
  await expect(assistant.getByText('确认后将替换当前学习目标「原目标」。')).toBeVisible();
  await assistant.getByRole('button', { name: '取消', exact: true }).click();
  await assistant.getByRole('button', { name: '设为当前目标', exact: true }).click();
  await expect(assistant.getByText('确认后将替换当前学习目标「原目标」。')).toBeVisible();
  const goal = '验证松开鼠标后停止计分';
  await assistant.getByLabel('这次要做什么').fill(goal);
  await assistant.getByRole('button', { name: '确认设定', exact: true }).click();
  await expect(assistant.getByRole('status')).toHaveText('已设为当前目标，可在今日学习查看。');
  await assistant.getByRole('link', { name: '打开原实践' }).click();
  await expect(page).toHaveURL(/#path\/click-outcome\/first-practice$/);
  await page.goto('/#today');
  await expect(page.getByText(goal, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '开发者工具', exact: true }).click();
  await page.getByRole('button', { name: /模拟完成 1 个番茄钟/ }).click();
  await expect.poll(() => page.evaluate((goal) => JSON.parse(localStorage.getItem('learning-assistant:study-logs')!)
    .some((log: { tags: string[] }) => log.tags.includes(`目标：${goal}`)), goal)).toBe(true);
  const backup = await downloadBackup(page);
  expect(backup.data.currentGoal.goal).toEqual({ type: 'practice', id: '#path/click-outcome/first-practice', label: goal });
  const other = await browser.newPage();
  try {
    await other.goto('/#data');
    await other.getByLabel('选择备份文件').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await Promise.all([other.waitForEvent('load'), other.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await other.goto('/#today');
    await expect(other.getByText(goal, { exact: true })).toBeVisible();
  } finally { await other.close(); }
});

test('解释选中的代码只在发送时附带片段和行号，移除后恢复普通问答', async ({ page }) => {
  await seedStudyContext(page);
  const calls: ChatRequest[] = [];
  await page.route('**/api/assistant-chat', async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ json: { answer: `解释 ${calls.length}` } });
  });
  await page.goto('/#history/' + firstDate);
  const { form } = await openLogCodeForm(page);
  await form.getByLabel('项目名称').fill('打地鼠');
  await form.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(firstContent.replaceAll('\n', '\r\n')) });
  await form.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(form).toBeHidden();
  await page.getByRole('link', { name: /InputManager\.cs/ }).click();
  const line = page.locator('[data-code-line="2"]');
  await expect(line).toContainText('private int hits');
  const fragment = '  private int hits = 1;\n}';
  await page.getByRole('region', { name: '脚本快照' }).locator('pre > code').evaluate((code, fragment) => {
    const offset = code.textContent!.indexOf(fragment);
    if (offset < 0) throw new Error('找不到测试选区：' + JSON.stringify(code.textContent));
    const range = document.createRange();
    range.selectNodeContents(code);
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    let at = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const end = at + node.textContent!.length;
      if (offset >= at && offset < end) range.setStart(node, offset - at);
      if (offset + fragment.length <= end) { range.setEnd(node, offset + fragment.length - at); break; }
      at = end;
    }
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }, fragment);
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(fragment);
  await line.evaluate((element) => {
    const { left, top } = element.getBoundingClientRect();
    element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: left + 90, clientY: top + 8 }));
  });
  const askMenu = page.getByRole('group', { name: '询问智能体', exact: true });
  await expect(askMenu.getByRole('button', { name: '询问脚本用途', exact: true })).toBeVisible();
  await askMenu.getByRole('button', { name: '询问所选代码', exact: true }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByText('引用 InputManager.cs · 第 2–3 行', { exact: true })).toBeVisible();
  expect(calls).toHaveLength(0);
  const question = assistant.getByRole('textbox', { name: '输入问题' });
  await question.fill('这段代码是做什么的？');
  await question.press('Enter');
  await expect(assistant.getByText('解释 1', { exact: true })).toBeVisible();
  expect(calls[0]).toEqual({ question: '这段代码是做什么的？', history: [], code: { path: 'InputManager.cs', startLine: 2, endLine: 3, text: fragment } });
  const context = assistant.getByRole('checkbox', { name: /附带上下文/ });
  await context.check();
  await question.fill('第一行为什么声明为 private？');
  await question.press('Enter');
  await expect(assistant.getByText('解释 2', { exact: true })).toBeVisible();
  expect(calls[1].code?.context).toEqual({ startLine: 1, endLine: 7, text: firstContent.trimEnd() });
  await assistant.getByRole('button', { name: '移除代码片段' }).click();
  await question.fill('C# 中 int 是什么？');
  await question.press('Enter');
  await expect(assistant.getByText('解释 3', { exact: true })).toBeVisible();
  expect(calls[2]).toEqual({ question: 'C# 中 int 是什么？', history: [] });
  await assistant.getByRole('button', { name: '引用代码', exact: true }).click();
  await assistant.getByLabel('起始行').fill('2');
  await assistant.getByLabel('结束行').fill('3');
  await expect(assistant.getByLabel('片段预览')).toContainText('private int hits');
  await assistant.getByRole('button', { name: '引用到问答' }).click();
  await expect(assistant.getByRole('checkbox', { name: /附带上下文/ })).not.toBeChecked();
  expect(calls).toHaveLength(3);
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await line.click({ position: { x: 90, y: 8 } });
  await expect(line).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-code-line="3"]')).not.toHaveAttribute('aria-current', 'true');
  await line.click({ button: 'right', position: { x: 90, y: 8 } });
  const askLine = askMenu.getByRole('button', { name: '询问当前行', exact: true });
  await expect(askLine).not.toBeFocused();
  await askMenu.getByRole('button', { name: '询问脚本用途', exact: true }).hover();
  await expect(askLine).toHaveCSS('outline-style', 'none');
  await page.getByRole('heading', { name: '脚本快照' }).click();
  await expect(askMenu).toBeHidden();
  const preview = page.getByRole('group', { name: '代码预览' });
  await preview.press('Shift+F10');
  await expect(askLine).toBeFocused();
  await expect(askLine).toHaveCSS('outline-width', '1px');
  await expect(askLine).toHaveCSS('outline-offset', '-1px');
  await expect(askLine).toHaveCSS('box-shadow', /0px 0px 0px 2px inset/);
  await page.keyboard.press('Escape');
  await expect(askMenu).toBeHidden();
  await expect(preview).toBeFocused();
  await line.click({ button: 'right', position: { x: 90, y: 8 } });
  await askLine.click();
  await expect(assistant.getByText('引用 InputManager.cs · 第 2 行', { exact: true })).toBeVisible();
});

test('询问脚本用途发送完整的常规脚本及说明，长脚本展示取样范围', async ({ page }) => {
  await seedStudyContext(page);
  const normal = ['class InputManager {', ...Array.from({ length: 120 }, (_, index) => `  // 输入和计分状态，记录 ${index}。${' abcdef'.repeat(9)}`), '}'].join('\n');
  const large = ['class ScoreManager {', ...Array.from({ length: 800 }, (_, index) => `  // 计分状态 ${index} ${'abcdefghij'.repeat(5)}`), '}'].join('\n');
  const calls: ChatRequest[] = [];
  await page.route('**/api/assistant-chat', async (route) => {
    calls.push(route.request().postDataJSON());
    const details = Array.from({ length: 20 }, (_, index) => `第 ${index + 1} 项，解释脚本职责。`).join('\n\n');
    await route.fulfill({ json: { answer: calls.length === 1 ? `脚本说明 1\n\n${details}` : '脚本说明 2' } });
  });
  await page.goto('/#history/' + firstDate);
  const { form } = await openLogCodeForm(page);
  await form.getByLabel('项目名称').fill('打地鼠');
  await form.getByLabel('版本说明（可选）').fill('将鼠标输入转成计分操作');
  await form.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(normal) });
  await form.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(form).toBeHidden();
  await page.getByRole('link', { name: /InputManager\.cs/ }).click();
  const codeLine = page.locator('[data-code-line="2"]');
  await codeLine.click({ button: 'right', position: { x: 90, y: 8 } });
  const askMenu = page.getByRole('group', { name: '询问智能体', exact: true });
  await expect(askMenu).toBeVisible();
  const codeScroll = page.getByRole('group', { name: '代码预览' }).locator('pre');
  await codeScroll.evaluate((element) => { element.scrollTop += 100; });
  await expect(askMenu).toBeHidden();
  await codeLine.click({ button: 'right', position: { x: 90, y: 8 } });
  await page.goto('/#history/' + firstDate);
  await page.getByRole('link', { name: /InputManager\.cs/ }).click();
  await expect(askMenu).toBeHidden();
  await codeLine.click({ button: 'right', position: { x: 90, y: 8 } });
  await askMenu.getByRole('button', { name: '询问脚本用途', exact: true }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  const composer = assistant.getByRole('form', { name: '发送问题' });
  const transcript = assistant.getByRole('log', { name: '问答记录' });
  await expect(assistant.getByText(/会发送完整脚本（122 行）/)).toBeVisible();
  expect(calls).toHaveLength(0);
  await composer.getByRole('button', { name: '这个脚本在项目中负责什么？', exact: true }).click();
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('脚本说明 1', { exact: true })).toBeVisible();
  expect(calls[0]).toEqual({ question: '这个脚本在项目中负责什么？', history: [], script: {
    path: 'InputManager.cs', project: '打地鼠', totalLines: 122, sampled: false,
    parts: [{ startLine: 1, endLine: 122, text: normal }], notes: ['将鼠标输入转成计分操作'],
  } });
  await expect.poll(() => transcript.evaluate((area) => area.scrollTop)).toBeGreaterThan(0);
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await codeLine.click({ button: 'right', position: { x: 90, y: 8 } });
  await askMenu.getByRole('button', { name: '询问当前行', exact: true }).click();
  const prompt = composer.getByRole('button', { name: '这段代码是做什么的？', exact: true });
  await expect(prompt).toBeInViewport();
  await expect(transcript.getByRole('button', { name: '这段代码是做什么的？', exact: true })).toHaveCount(0);
  await prompt.click();
  await expect(composer.getByRole('textbox', { name: '输入问题' })).toHaveValue('这段代码是做什么的？');
  await expect(composer.getByRole('textbox', { name: '输入问题' })).toBeFocused();
  expect(calls).toHaveLength(1);
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await page.goto('/#history/' + firstDate);
  await page.reload();
  const second = await openLogCodeForm(page, 1);
  await second.form.getByLabel('本地 .cs 文件').setInputFiles({ name: 'ScoreManager.cs', mimeType: 'text/plain', buffer: Buffer.from(large) });
  await second.form.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(second.form).toBeHidden();
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  await assistant.getByRole('button', { name: '引用代码', exact: true }).click();
  const version = assistant.getByLabel('脚本版本');
  await version.selectOption(await version.locator('option').filter({ hasText: 'ScoreManager.cs' }).getAttribute('value') ?? '');
  await assistant.getByRole('button', { name: '询问脚本用途', exact: true }).click();
  await expect(assistant.getByText(/脚本较长，会发送首尾两段/)).toBeVisible();
  await assistant.getByRole('textbox', { name: '输入问题' }).fill('这个脚本的职责是什么？');
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('脚本说明 2', { exact: true })).toBeVisible();
  const script = calls[1].script!;
  expect(script).toMatchObject({ path: 'ScoreManager.cs', sampled: true, totalLines: 802 });
  expect(script.parts[0].text).toBe(large.slice(0, 12000));
  expect(script.parts[1].text).toBe(large.slice(-12000));
  expect(calls[1].history).toEqual([]);
});

test('项目目录预览、批量保存、职责说明、日志回链与备份恢复', async ({ page, browser }, testInfo) => {
  const root = testInfo.outputPath('打地鼠项目');
  const samplePath = process.env.UNITY_SCRIPT_SAMPLE;
  const sample = samplePath ? await readFile(samplePath, 'utf8') : firstContent;
  for (const [relativePath, content] of [
    [scriptPath, sample],
    ['Assets/Scripts/Mole.cs', 'public class Mole {}'],
    ['Assets/Scripts/Bad.cs', Buffer.from([0xff, 0xfe])],
    ['Assets/Scenes/Game.unity', 'scene'],
    ['Assets/Scenes/Game.unity.meta', 'meta'],
    ['Library/Cache.cs', 'cache'],
    ['Builds/Game.exe', 'build'],
    ['ProjectSettings/ProjectVersion.txt', '2022.3'],
  ] as const) {
    const file = path.join(root, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  await seedStudyContext(page);
  await page.goto('/#code');
  const importer = page.getByRole('form', { name: '导入项目目录' });
  const project = page.getByRole('article', { name: '打地鼠项目', exact: true });
  const tree = importer.getByRole('region', { name: '项目目录树' });
  const chooseDirectory = async () => {
    await importer.getByLabel('本地项目文件夹').setInputFiles(root);
    await expect(tree.getByText('Assets', { exact: true })).toBeVisible();
    await tree.getByRole('button', { name: '展开 Assets', exact: true }).click();
    await tree.getByRole('button', { name: '展开 Assets/Scripts', exact: true }).click();
  };
  const readCode = () => page.evaluate(async () => {
    const { readProjectCode } = await import('/src/utils/projectCodeStorage.ts');
    return readProjectCode();
  }) as Promise<ProjectCodeData>;
  const save = importer.getByRole('button', { name: '保存目录快照' });
  const addVersion = page.getByRole('button', { name: '添加代码版本', exact: true });
  const importDirectory = page.getByRole('button', { name: '导入项目目录', exact: true });
  const versionForm = page.getByRole('form', { name: '保存代码版本' });
  await addVersion.click();
  await expect(addVersion).toHaveAttribute('aria-expanded', 'true');
  await versionForm.getByRole('button', { name: '取消' }).click();
  await expect(addVersion).toBeFocused();
  await importDirectory.click();
  await expect(page).toHaveURL(/\/#code$/);
  await expect(importDirectory).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('还没有项目。', { exact: false })).toBeVisible();
  await chooseDirectory();
  await expect(importer.getByLabel('项目名称')).toHaveValue('打地鼠项目');
  await expect(tree.getByText('Library', { exact: true })).toHaveCount(0);
  await expect(tree.getByText('Builds', { exact: true })).toHaveCount(0);
  const script = tree.getByRole('checkbox', { name: `保存脚本 ${scriptPath}` });
  const bad = tree.getByRole('checkbox', { name: '保存脚本 Assets/Scripts/Bad.cs' });
  await script.check();
  await bad.check();
  await save.click();
  await expect(importer.getByRole('alert')).toContainText('Assets/Scripts/Bad.cs');
  expect((await readCode()).projects).toHaveLength(0);
  await bad.uncheck();
  await save.click();
  await expect(project.getByRole('status')).toContainText('新增 1 个代码版本');
  const saved = (await readCode()).versions[0];
  expect(saved.path).toBe(scriptPath);
  expect(saved.content).toContain('class InputManager');
  const savedTree = project.getByRole('region', { name: '项目目录树' });
  await savedTree.getByRole('button', { name: '展开 Assets', exact: true }).click();
  await savedTree.getByRole('button', { name: 'Scripts', exact: true }).click();
  await project.getByRole('textbox', { name: '职责说明', exact: true }).fill('存放本练习的玩法脚本。');
  await project.getByRole('button', { name: '保存职责说明' }).click();
  await expect(project.getByText('职责说明已保存。')).toBeVisible();
  await savedTree.getByRole('button', { name: '展开 Assets/Scripts', exact: true }).click();
  await savedTree.getByRole('button', { name: /InputManager\.cs/ }).click();
  await project.getByRole('textbox', { name: '职责说明', exact: true }).fill('处理玩家输入。');
  await project.getByRole('button', { name: '保存职责说明' }).click();
  await expect(project.getByText('职责说明已保存。')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('project-directory.png') });
  await project.getByRole('list', { name: '此路径的代码版本' }).getByRole('link').click();
  await expect(page).toHaveURL(new RegExp('/#code/' + saved.id + '$'));
  await expect(page.getByRole('region', { name: '脚本快照' }).locator('pre code')).toContainText('class InputManager');

  await page.goto('/#history/' + firstDate);
  const panel = page.getByRole('region', { name: '项目代码', exact: true });
  await panel.getByText('项目代码（0）', { exact: true }).click();
  await panel.getByRole('button', { name: '添加代码版本', exact: true }).click();
  const reveal = panel.locator('.code-form-reveal');
  const collapse = await reveal.evaluate(async (element) => {
    await Promise.allSettled(element.getAnimations().map(({ finished }) => finished));
    const before = element.getBoundingClientRect().height;
    element.querySelector<HTMLButtonElement>('form button[type="button"]')!.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const transition = element.getAnimations().find((animation) =>
      animation instanceof CSSTransition && animation.transitionProperty === 'grid-template-rows');
    if (!transition) return { before, middle: 0 };
    transition.pause();
    transition.currentTime = Number(transition.effect?.getComputedTiming().duration) / 2;
    const middle = element.getBoundingClientRect().height;
    transition.finish();
    return { before, middle };
  });
  expect(collapse.middle).toBeGreaterThan(0);
  expect(collapse.middle).toBeLessThan(collapse.before);
  await expect(reveal).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '添加代码版本', exact: true })).toBeFocused();
  const versionPicker = panel.getByRole('combobox', { name: '选择已有代码版本' });
  await versionPicker.fill('不同项目');
  await expect(panel.getByRole('option')).toHaveCount(0);
  await versionPicker.fill('打地鼠项目 InputManager');
  await expect(panel.getByRole('option')).toHaveCount(1);
  await panel.getByRole('option').click();
  await expect(versionPicker).toHaveValue(/InputManager\.cs/);
  await panel.getByRole('button', { name: '关联所选版本' }).click();
  await panel.getByRole('link', { name: scriptPath, exact: true }).click();
  await expect(page.getByRole('link', { name: /学习日志 ·/ })).toHaveAttribute('href', '#history/' + firstDate);
  await page.goto('/#code');

  await project.getByRole('button', { name: '更新目录快照' }).click();
  await expect(project.getByRole('form', { name: '导入项目目录' })).toBeVisible();
  await chooseDirectory();
  await script.check();
  await tree.getByRole('checkbox', { name: '保存脚本 Assets/Scripts/Mole.cs' }).check();
  await save.click();
  await expect(project.getByRole('status')).toContainText('新增 1 个代码版本 · 复用 1 个已有版本');
  await project.getByRole('button', { name: '编辑项目资料' }).click();
  await project.getByLabel('GitHub 仓库地址（可选）').fill(repository);
  await project.getByRole('button', { name: '保存项目资料' }).click();
  await expect(project.getByRole('link', { name: '打开 GitHub 仓库' })).toHaveAttribute('href', repository);

  const backup = await downloadBackup(page);
  const code: ProjectCodeData = backup.data.projectCode;
  expect(backup.version).toBe(9);
  expect(code.versions.map(({ path }) => path)).toEqual([scriptPath, 'Assets/Scripts/Mole.cs']);
  expect(code.projects[0].directory).toMatchObject({
    files: ['Assets/Scenes/Game.unity', 'Assets/Scripts/Bad.cs', scriptPath, 'Assets/Scripts/Mole.cs', 'ProjectSettings/ProjectVersion.txt'],
    notes: [{ path: 'Assets/Scripts', text: '存放本练习的玩法脚本。' }, { path: scriptPath, text: '处理玩家输入。' }],
  });
  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    const input = restored.getByLabel('选择备份文件');
    const broken = structuredClone(backup);
    broken.data.projectCode.projects[0].directory.files.push('../outside');
    await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) });
    await expect(restored.getByRole('button', { name: '确认恢复并刷新' })).toHaveCount(0);
    await expect(restored.getByRole('status')).toHaveText('项目代码数据格式不正确。');
    await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await expect(restored.getByText('1 份项目目录快照及其职责说明。')).toBeVisible();
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await restored.goto('/#code');
    await restored.getByText('目录快照（5 个文件）').click();
    const restoredTree = restored.getByRole('region', { name: '项目目录树' });
    await restoredTree.getByRole('button', { name: '展开 Assets', exact: true }).click();
    await restoredTree.getByRole('button', { name: '展开 Assets/Scripts', exact: true }).click();
    await restoredTree.getByRole('button', { name: /InputManager\.cs/ }).click();
    await expect(restored.getByRole('textbox', { name: '职责说明', exact: true })).toHaveValue('处理玩家输入。');
    await expect(restored.getByRole('list', { name: '此路径的代码版本' }).getByRole('link')).toHaveAttribute('href', '#code/' + saved.id);
  } finally {
    await context.close();
  }
});

test('删除没有在用版本的项目，回收站可恢复项目或彻底清理它', async ({ page }) => {
  await seedStudyContext(page);
  await page.goto('/#code');
  const versionId = await page.evaluate(async ({ script, content }) => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const code = useProjectCodeStore.getState();
    const { projectId } = await code.importDirectory({
      project: { name: '归档目录项目', tutorialUrl: '', repositoryUrl: '' },
      files: [script], scripts: [{ path: script, content }],
    });
    const versionId = useProjectCodeStore.getState().data.versions[0].id;
    await code.saveDirectoryNote(projectId, script, '输入处理');
    await code.linkVersion(versionId, { kind: 'log', id: 'code-log' });
    return versionId;
  }, { script: scriptPath, content: firstContent });

  const project = page.getByRole('article', { name: '归档目录项目' });
  const deleteProject = project.getByRole('button', { name: '删除项目', exact: true });
  await expect(project).toBeVisible();
  await expect(deleteProject).toHaveCount(0);
  const trashVersion = async () => {
    await page.goto('/#code/' + versionId);
    await page.getByRole('button', { name: '删除代码版本' }).click();
    await page.getByRole('button', { name: '移入回收站' }).click();
    await expect(deleteProject).toBeVisible();
  };
  const dialog = page.getByRole('dialog', { name: '删除项目', exact: true });
  await trashVersion();
  await deleteProject.click();
  await expect(dialog).toContainText('回收站中的 1 个代码版本仍可恢复');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(project).toBeVisible();
  await deleteProject.click();
  await dialog.getByRole('button', { name: '确认删除' }).click();
  await expect(project).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('还没有项目。', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: '导入项目目录', exact: true }).click();
  const importer = page.getByRole('form', { name: '导入项目目录' });
  await expect(importer.getByLabel('保存到')).toHaveCount(0);
  await importer.getByRole('button', { name: '取消', exact: true }).click();
  await page.goto('/#data?trash=code');
  const bin = page.getByRole('region', { name: '回收站' });
  await expect(bin.getByRole('listitem')).toContainText('归档目录项目');
  await bin.getByRole('button', { name: '恢复代码版本' }).click();
  await page.getByRole('button', { name: '确认恢复' }).click();
  await bin.getByRole('link', { name: scriptPath }).click();
  await expect(page.getByRole('link', { name: /学习日志 ·/ })).toHaveAttribute('href', '#history/' + firstDate);
  await page.goto('/#code');
  await expect(project.getByText('目录快照（1 个文件）')).toBeVisible();

  await trashVersion();
  await deleteProject.click();
  await dialog.getByRole('button', { name: '确认删除' }).click();
  await page.goto('/#data?trash=code');
  await bin.getByRole('button', { name: '彻底删除' }).click();
  await page.getByRole('button', { name: '确认彻底删除' }).click();
  await expect(bin.getByRole('listitem')).toHaveCount(0);
  const backup = await downloadBackup(page);
  expect(backup.data.projectCode.projects).toHaveLength(0);
  expect(backup.data.projectCode.trash.versions).toHaveLength(0);
  expect(backup.data.projectCode.trash.links).toHaveLength(0);
  expect(backup.data.studyLogs.map(({ id }: { id: string }) => id)).toContain('code-log');
});

test('编辑项目资料原位展开，取消与保存都平滑收起并归还焦点', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#code');
  await page.getByRole('button', { name: '添加代码版本', exact: true }).click();
  const version = page.getByRole('form', { name: '保存代码版本' });
  await version.getByLabel('项目名称').fill('Unity 学习演示');
  await version.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(firstContent) });
  await version.getByRole('button', { name: '保存版本', exact: true }).click();
  await page.getByRole('link', { name: '所有项目', exact: true }).click();

  const project = page.getByRole('article', { name: 'Unity 学习演示', exact: true });
  const edit = project.getByRole('button', { name: '编辑项目资料', exact: true });
  const form = project.getByRole('form', { name: '编辑项目资料' });
  const panel = project.locator('.code-form-reveal').filter({ has: page.locator('form[aria-label="编辑项目资料"]') });
  await page.addStyleTag({ content: '@media (prefers-reduced-motion: no-preference) { .code-project { --app-motion-duration: 800ms; } }' });
  const isAnimating = () => panel.evaluate((element) => element.getAnimations().some(
    (animation) => animation instanceof CSSTransition && animation.transitionProperty === 'grid-template-rows',
  ));

  await edit.click();
  await expect(edit).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(isAnimating).toBe(true);
  const name = form.getByLabel('项目名称');
  await name.fill('不会保存的草稿');
  await form.getByRole('button', { name: '取消', exact: true }).click();
  await expect(edit).toHaveAttribute('aria-expanded', 'false');
  await expect(edit).toBeFocused();
  await expect(panel).toHaveAttribute('inert', '');
  await expect.poll(isAnimating).toBe(true);
  await expect(panel).toHaveCount(0);

  await edit.press('Enter');
  await expect(name).toHaveValue('Unity 学习演示');
  await form.getByLabel('GitHub 仓库地址（可选）').fill(repository);
  await form.getByRole('button', { name: '保存项目资料' }).click();
  await expect(edit).toBeFocused();
  await expect.poll(isAnimating).toBe(true);
  await expect(panel).toHaveCount(0);
  await expect(project.getByRole('link', { name: '打开 GitHub 仓库' })).toHaveAttribute('href', repository);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await edit.click();
  await expect(panel).toHaveCSS('transition-duration', '0s');
  await form.getByRole('button', { name: '取消', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(edit).toBeFocused();
});

test('只读目录跳过 Unity 缓存，保存前不读脚本正文，版本资料原位编辑', async ({ page }) => {
  await page.addInitScript(() => {
    const audit: string[] = [];
    Object.defineProperty(window, 'directoryAudit', { value: audit });
    const folder = (name: string, children: object[]) => ({ name, kind: 'directory', async *values() {
      audit.push('list:' + name);
      yield* children;
    } });
    const file = (name: string) => ({ name, kind: 'file', async getFile() {
      audit.push('read:' + name);
      return new File(['class Player {}'], name, { type: 'text/plain' });
    } });
    Object.defineProperty(window, 'showDirectoryPicker', { value: async ({ mode }: { mode: string }) => {
      audit.push(mode);
      return folder('Unity 场景', [folder('Library', [file('Skipped.cs')]),
        folder('Assets', [file('Player.cs'), file('Player.cs.meta'), file('Scene.unity')])]);
    } });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#code');
  await page.getByRole('button', { name: '导入项目目录', exact: true }).click();
  const importer = page.getByRole('form', { name: '导入项目目录' });
  await importer.getByRole('button', { name: '选择项目文件夹（只读）' }).click();
  await importer.getByRole('button', { name: '展开 Assets' }).click();
  const audit = () => page.evaluate(() => (window as Window & { directoryAudit?: string[] }).directoryAudit);
  expect(await audit()).toEqual(['read', 'list:Unity 场景', 'list:Assets']);
  const saveScript = importer.getByRole('checkbox', { name: '保存脚本 Assets/Player.cs' });
  await saveScript.check();
  await importer.getByRole('button', { name: '折叠 Assets' }).click();
  await expect(saveScript).toBeHidden();
  await importer.getByRole('button', { name: '展开 Assets' }).click();
  await expect(saveScript).toBeChecked();
  await expect(importer.getByText('Library', { exact: true })).toHaveCount(0);
  await importer.getByRole('button', { name: '保存目录快照' }).click();
  const project = page.getByRole('article', { name: 'Unity 场景' });
  await project.getByRole('link', { name: 'Assets/Player.cs', exact: true }).click();
  expect(await audit()).toEqual(['read', 'list:Unity 场景', 'list:Assets', 'read:Player.cs']);
  const snapshot = page.getByRole('region', { name: '脚本快照' });
  const trigger = page.getByRole('button', { name: '编辑版本资料', exact: true });
  const currentUrl = page.url();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const detail = page.getByRole('form', { name: '编辑代码版本资料' });
  await expect(snapshot).toBeVisible();
  await detail.getByLabel('版本说明（可选）').fill('原位修改成功');
  await detail.getByRole('button', { name: '保存版本资料' }).click();
  await expect(detail).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(currentUrl);
  await expect(page.getByText('原位修改成功', { exact: true })).toBeVisible();
});

test('日志引用固定代码版本，可预览行号、跳到整段并在新版保存后仍读旧版', async ({ page, browser }) => {
  await seedStudyContext(page);
  await page.goto('/#history/' + firstDate);
  const { panel, form } = await openLogCodeForm(page);
  await form.getByLabel('项目名称').fill('输入练习');
  await form.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(firstContent) });
  await form.getByLabel('版本说明（可选）').fill('Day 03 · 读取输入');
  await form.getByRole('button', { name: '保存版本', exact: true }).click();
  const source = panel.getByRole('link', { name: 'InputManager.cs', exact: true });
  const href = await source.getAttribute('href');
  await page.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  const editor = page.getByRole('form', { name: '历史记录编辑表单' });
  const body = editor.getByLabel('历史学习内容', { exact: true });
  await body.fill('看看输入设置。 ');
  await body.press('End');
  await editor.getByText('插入代码引用', { exact: true }).click();
  await editor.getByRole('combobox', { name: '引用代码版本' }).fill('Day 03');
  await editor.getByRole('option', { name: /Day 03/ }).click();
  await editor.getByLabel('链接文字（可选）').fill('Update()');
  await editor.getByLabel('起始行（可选）').fill('2');
  const end = editor.getByLabel('结束行（可选）');
  await end.fill('999');
  await expect(editor.getByRole('button', { name: '插入到正文' })).toBeDisabled();
  await end.fill('3');
  await editor.getByRole('button', { name: '插入到正文' }).click();
  await expect(body).toHaveValue('看看输入设置。 [Update()](<' + href + '?cite=1&lines=2-3>)');
  await editor.getByRole('button', { name: '保存补充' }).click();
  await page.reload();

  const reference = page.getByRole('link', { name: 'Update()', exact: true });
  await reference.hover();
  const preview = page.getByRole('tooltip');
  await expect(preview).toContainText('Day 03 · 读取输入');
  await expect(preview.locator('[data-code-line]')).toHaveCount(2);
  await expect(preview.locator('[data-code-line="2"]')).toContainText('hits = 1');
  await expect(preview.locator('code')).toHaveCSS('font-family', /Fira Code/);
  await expect.poll(() => page.evaluate(async () => {
    const faces = await document.fonts.load('13px "Fira Code"', 'Update');
    return faces.length > 0 && faces.every((face) => face.status === 'loaded');
  })).toBe(true);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await page.mouse.move(0, 0);
  await reference.focus();
  await expect(preview).toBeVisible();
  await reference.press('Enter');
  await expect(page.getByRole('region', { name: '脚本快照' }).locator('[data-code-cited="true"]')).toHaveCount(2);
  await expect(page.locator('[data-code-line="2"]')).toContainText('hits = 1');
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async (value: string) => {
      sessionStorage.setItem('copied-code-reference', value);
    } });
  });
  await page.locator('[data-code-line="2"]').click({ button: 'right' });
  await page.getByRole('button', { name: '复制日志引用' }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('copied-code-reference'))).toBe('[InputManager.cs · L2](<' + href + '?cite=1&lines=2-2>)');
  await page.goto('/#code');
  await page.getByRole('button', { name: '添加代码版本', exact: true }).click();
  const newer = page.getByRole('form', { name: '保存代码版本' });
  await newer.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(secondContent) });
  await newer.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(page.getByRole('region', { name: '脚本快照' }).locator('code')).toContainText('hits = 2');
  await page.goto('/#history/' + firstDate);
  await reference.click();
  await expect(page.locator('[data-code-line="2"][data-code-cited]')).toContainText('hits = 1');
  await expect(page.getByRole('region', { name: '引用记录' }).getByRole('link', { name: /学习日志/ })).toHaveCount(1);
  await page.getByRole('button', { name: '删除代码版本' }).click();
  await page.getByRole('dialog', { name: '删除代码版本' }).getByRole('button', { name: '移入回收站' }).click();
  await page.goto('/#history/' + firstDate);
  await reference.hover();
  await expect(preview).toContainText('代码版本已移入回收站');
  await expect(preview.locator('code')).toHaveCount(0);
  await reference.click();
  await expect(page.getByText('代码版本已移入回收站。')).toBeVisible();
  await page.getByRole('link', { name: '打开回收站' }).click();
  await page.getByRole('button', { name: '恢复代码版本', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认恢复' }).click();
  await expect(page.getByText('已恢复代码版本', { exact: false })).toBeVisible();
  await page.goto('/#history/' + firstDate);
  await reference.hover();
  await expect(preview.locator('[data-code-line="2"]')).toContainText('hits = 1');
  const backup = await downloadBackup(page);
  const restored = await browser.newPage({ baseURL: new URL(page.url()).origin });
  try {
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await restored.goto('/#history/' + firstDate);
    await restored.getByRole('link', { name: 'Update()', exact: true }).click();
    await expect(restored.locator('[data-code-line="2"][data-code-cited]')).toContainText('hits = 1');
  } finally { await restored.close(); }
});

test('同名脚本分版本保存，日志、词条与两次实践打开对应版本', async ({ page }) => {
  await seedStudyContext(page);
  await page.goto('/#history/' + firstDate);
  const first = await openLogCodeForm(page);
  await first.form.getByLabel('项目名称').fill('打地鼠练习');
  await first.form.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(firstContent) });
  await first.form.getByLabel('项目内路径（可选）').fill('Assets\\Scripts\\InputManager.cs');
  await first.form.getByLabel('版本说明（可选）').fill('本地初次实现');
  await first.form.getByRole('button', { name: '保存版本', exact: true }).click();
  const firstLink = first.panel.getByRole('link', { name: scriptPath, exact: true });
  const firstHref = await firstLink.getAttribute('href');
  await firstLink.click();
  const preview = page.getByRole('region', { name: '脚本快照' });
  await expect(preview.locator('pre code.hljs')).toContainText('hits = 1');
  await expect(preview.locator('img')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '引用记录' }).getByRole('link', { name: /点击判断笔记/ })).toHaveAttribute('href', '#history/' + firstDate);
  await page.getByRole('link', { name: '所有项目', exact: true }).click();
  const project = page.getByRole('article', { name: '打地鼠练习', exact: true });
  await project.getByRole('button', { name: '编辑项目资料' }).click();
  await project.getByLabel('GitHub 仓库地址（可选）').fill(repository + '.git');
  await project.getByRole('button', { name: '保存项目资料' }).click();
  await expect(project.getByRole('link', { name: '打开 GitHub 仓库' })).toHaveAttribute('href', repository);

  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '今日学习', exact: true }).click();
  const second = await openLogCodeForm(page);
  await expect(second.form.getByLabel('所属项目').locator('option:checked')).toHaveText('打地鼠练习');
  await second.form.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(secondContent) });
  await second.form.getByLabel('GitHub 固定链接').fill(repository + '/blob/main/' + scriptPath);
  await second.form.getByLabel('版本说明（可选）').fill('提交后的第二版');
  await second.form.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(second.form.getByRole('alert')).toContainText('指向具体提交');
  await expect(second.panel.getByRole('link', { name: scriptPath, exact: true })).toHaveCount(0);
  await second.form.getByLabel('GitHub 固定链接').fill(permalink + '?plain=1#L2-L3');
  await second.form.getByRole('button', { name: '保存版本', exact: true }).click();
  const secondHref = await second.panel.getByRole('link', { name: scriptPath, exact: true }).getAttribute('href');
  expect(secondHref).not.toBe(firstHref);

  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '成长记录' }).click();
  const outcome = page.getByRole('article', { name: '点击目标时增加分数' });
  await outcome.getByRole('link', { name: '点击目标时增加分数', exact: true }).click();
  const firstPractice = outcome.locator('.growth-practices > li').filter({ hasText: '第一次实现点击' });
  const secondPractice = outcome.locator('.growth-practices > li').filter({ hasText: '第二次调整判断' });
  for (const [practice, note, href] of [[firstPractice, '本地初次实现', firstHref], [secondPractice, '提交后的第二版', secondHref]] as const) {
    await practice.getByRole('button', { name: '编辑实践', exact: true }).click();
    const form = page.getByRole('form', { name: '实践记录表单' });
    await form.getByText('关联代码版本（0）', { exact: true }).click();
    await form.getByRole('checkbox', { name: new RegExp(note) }).check();
    await form.getByRole('button', { name: '保存实践', exact: true }).click();
    await expect(practice.getByRole('link', { name: '代码 · ' + scriptPath, exact: true })).toHaveAttribute('href', href!);
  }
  await secondPractice.getByRole('link', { name: '代码 · ' + scriptPath, exact: true }).click();
  await expect(preview.locator('pre code')).toContainText('hits = 2');
  await expect(page.getByRole('link', { name: '在 GitHub 查看此版本' })).toHaveAttribute('href', permalink + '#L2-L3');
  await page.getByRole('link', { name: /成长实践 · 点击目标时增加分数/ }).click();
  await expect(page).toHaveURL(/#path\/click-outcome\/second-practice$/);
  await expect(outcome.locator('[data-practice-focus]')).toContainText('第二次调整判断');

  await page.goto('/#knowledge/code-entry');
  await page.evaluate(async (versionId) => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    await useProjectCodeStore.getState().linkVersion(versionId, { kind: 'entry', id: 'code-entry' });
  }, firstHref!.split('/').at(-1)!);
  await page.reload();
  const examples = page.getByRole('region', { name: '项目用例' });
  const wordEdit = page.getByRole('button', { name: '编辑词条', exact: true });
  const wordForm = page.getByRole('form', { name: '词条编辑表单' });
  await wordEdit.click();
  await expect(page.getByRole('complementary', { name: '词条目录' })).toBeHidden();
  await wordForm.getByText('关联代码版本（1）', { exact: true }).click();
  const initialCode = wordForm.getByRole('checkbox', { name: /本地初次实现/ });
  await expect(initialCode).toBeChecked();
  await initialCode.uncheck();
  await wordForm.getByRole('button', { name: '取消词条编辑', exact: true }).click();
  await expect(examples.getByRole('link', { name: /本地初次实现/ })).toHaveAttribute('href', firstHref!);
  await wordEdit.click();
  await wordForm.getByText('关联学习日志（0）', { exact: true }).click();
  await wordForm.getByRole('checkbox', { name: /点击判断笔记/ }).check();
  await wordForm.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(page.getByRole('region', { name: '相关学习记录' }).getByRole('link', { name: /点击判断笔记/ })).toBeVisible();
  await examples.getByRole('link', { name: /本地初次实现/ }).click();
  await page.reload();
  await expect(preview.locator('pre code')).toContainText('hits = 1');
  await expect(preview.locator('pre code')).not.toContainText('hits = 2');
  await expect(page.getByRole('link', { name: '知识词条 · 点击判断', exact: true })).toHaveAttribute('href', '#knowledge/code-entry');
  await page.getByRole('button', { name: '删除代码版本', exact: true }).click();
  const deleteVersion = page.getByRole('dialog', { name: '删除代码版本' });
  await deleteVersion.getByRole('button', { name: '取消', exact: true }).click();
  await expect(preview).toBeVisible();
  await page.getByRole('button', { name: '删除代码版本', exact: true }).click();
  await deleteVersion.getByRole('button', { name: '移入回收站' }).click();
  await expect(page.getByRole('article', { name: '打地鼠练习' })).toContainText('1 个代码版本');
  await page.goto('/#history/' + firstDate);
  await expect(page.getByRole('region', { name: '项目代码', exact: true }).getByText('项目代码（0）', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '点击判断笔记' })).toBeVisible();
});

test('回收站分类并排显示，代码版本随备份恢复并清理彻底删除的关联', async ({ page, browser }) => {
  await seedStudyContext(page);
  await page.goto('/#code');
  const { archivedId, latestId } = await page.evaluate(async ({ script, original, latest }) => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const { useGrowthStore } = await import('/src/store/growthStore.ts');
    const code = useProjectCodeStore.getState();
    const archivedId = await code.saveVersion({ project: { name: '回收测试项目', repositoryUrl: '', tutorialUrl: '' },
      path: script, content: original, githubUrl: '', note: '旧快照' }, { kind: 'log', id: 'code-log' });
    const project = useProjectCodeStore.getState().data.projects[0];
    const latestId = await code.saveVersion({ project: { id: project.id }, path: script, content: latest, githubUrl: '', note: '在用快照' });
    await code.annotateLogCode(archivedId, 'code-log', { label: '初版', note: '保留关联说明' });
    const knowledge = useKnowledgeStore.getState();
    knowledge.setEntryCodeLinked('code-entry', archivedId, true, { label: '示例', note: '来自实践' });
    knowledge.trashEntry('code-entry');
    const growth = useGrowthStore.getState();
    const originalOutcome = growth.outcomes[0];
    growth.savePractice(originalOutcome, { ...originalOutcome.practices[0], codeVersionIds: [archivedId] });
    useStudyLogStore.getState().trashLog('code-log');
    return { archivedId, latestId };
  }, { script: scriptPath, original: firstContent, latest: secondContent });
  await page.goto('/#code/' + archivedId);
  await page.getByRole('button', { name: '删除代码版本' }).click();
  await page.getByRole('button', { name: '移入回收站' }).click();
  const project = page.getByRole('article', { name: '回收测试项目' });
  await expect(project.getByRole('link', { name: scriptPath, exact: true })).toHaveAttribute('href', '#code/' + latestId);
  await project.getByRole('link', { name: '回收站' }).click();
  const bin = page.getByRole('region', { name: '回收站' });
  const categories = bin.getByRole('navigation', { name: '回收站分类' });
  await page.setViewportSize({ width: 375, height: 780 });
  await expect(categories.getByRole('link', { name: '代码', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(await categories.getByRole('link').evaluateAll((links) => new Set(links.map((link) => link.getBoundingClientRect().top)).size)).toBe(1);
  await expect(bin.getByRole('listitem')).toHaveCount(1);
  await expect(bin.getByRole('listitem')).toContainText('旧快照');
  await categories.getByRole('link', { name: '词条', exact: true }).click();
  await expect(bin.getByRole('listitem')).toHaveText(/点击判断/);
  await categories.getByRole('link', { name: '日志', exact: true }).click();
  await expect(bin.getByRole('listitem')).toHaveText(/点击判断笔记/);
  await page.setViewportSize({ width: 1280, height: 800 });
  const backup = await downloadBackup(page);
  expect(backup.version).toBe(9);
  expect(backup.data.projectCode.trash.versions[0].id).toBe(archivedId);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    const restoredBin = restored.getByRole('region', { name: '回收站' });
    await restored.goto('/#data?trash=entry');
    await restored.getByLabel('选择备份文件').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await expect(restored.getByText('回收站中有 1 个代码版本。')).toBeVisible();
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await restoredBin.getByRole('button', { name: '恢复词条' }).click();
    await restored.getByRole('button', { name: '确认恢复' }).click();
    await restoredBin.getByRole('link', { name: '代码', exact: true }).click();
    await restoredBin.getByRole('button', { name: '恢复代码版本' }).click();
    await restored.getByRole('button', { name: '确认恢复' }).click();
    await restoredBin.getByRole('link', { name: scriptPath, exact: true }).click();
    await expect(restored).toHaveURL(new RegExp(`#code/${archivedId}$`));
    await expect(restored.locator('.code-version pre code')).toContainText('hits = 1');
    await expect(restored.getByRole('link', { name: '知识词条 · 点击判断' })).toBeVisible();
    await expect(restored.getByRole('link', { name: /成长实践 · 点击目标时增加分数/ })).toBeVisible();
    await restored.goto('/#data');
    await restoredBin.getByRole('button', { name: '恢复日志' }).click();
    await restored.getByRole('button', { name: '确认恢复' }).click();
    const afterRestore = await downloadBackup(restored);
    expect(afterRestore.data.projectCode.versions.map(({ id }: { id: string }) => id)).toEqual([archivedId, latestId]);
    expect(afterRestore.data.projectCode.links[0].annotation.note).toBe('保留关联说明');

    await restored.goto('/#code/' + archivedId);
    await restored.getByRole('button', { name: '删除代码版本' }).click();
    await restored.getByRole('button', { name: '移入回收站' }).click();
    await restored.getByRole('article', { name: '回收测试项目' }).getByRole('link', { name: '回收站' }).click();
    await restoredBin.getByRole('button', { name: '彻底删除' }).click();
    await restored.getByRole('button', { name: '确认彻底删除' }).click();
    await expect(restoredBin.getByText('代码版本已彻底删除。')).toBeVisible();
    const final = await downloadBackup(restored);
    expect(final.data.projectCode.versions[0].id).toBe(latestId);
    expect(final.data.projectCode.trash.versions).toHaveLength(0);
    expect(final.data.knowledge.entries[0].codeVersionIds).toEqual([]);
    expect(final.data.knowledge.entries[0].codeAnnotations).toEqual([]);
    expect(final.data.growth.outcomes[0].practices[0].codeVersionIds).toEqual([]);
    const { trash: _trash, ...oldCode } = final.data.projectCode;
    const oldVersion = await restored.evaluate(async (legacy) => {
      const { parseBackup } = await import('/src/utils/dataBackup.ts');
      return parseBackup(legacy).data.projectCode.trash.versions.length;
    }, { ...final, version: 7, data: { ...final.data, projectCode: oldCode } });
    expect(oldVersion).toBe(0);
  } finally { await context.close(); }
});

test('实践编辑统一保存三类资料，旧代码关联可预选、取消和移除', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await seedStudyContext(page);
  await page.goto('/#path');
  const versionId = await page.evaluate(async ({ script, code }) => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    return await useProjectCodeStore.getState().saveVersion({
      project: { name: '旧关联项目', repositoryUrl: '', tutorialUrl: '' },
      path: script, content: code, githubUrl: '', note: '可选的代码版本',
    }, { kind: 'practice', id: 'first-practice', outcomeId: 'click-outcome' });
  }, { script: scriptPath, code: firstContent });
  await page.reload();
  await page.getByRole('link', { name: '点击目标时增加分数', exact: true }).click();
  const old = page.getByRole('article', { name: '点击目标时增加分数' }).locator('.growth-practices > li').filter({ hasText: '第一次实现点击' });
  const codeLink = old.getByRole('link', { name: '代码 · ' + scriptPath, exact: true });
  await expect(codeLink).toHaveAttribute('href', '#code/' + versionId);
  const recent = page.getByRole('region', { name: '实践记录' });
  const form = page.getByRole('form', { name: '实践记录表单' });
  const choice = form.getByRole('checkbox', { name: /可选的代码版本/ });
  const save = form.getByRole('button', { name: '保存实践', exact: true });

  await old.getByRole('button', { name: '编辑实践', exact: true }).click();
  await expect(recent).toBeHidden();
  await expect(form.getByRole('heading', { name: '编辑实践', exact: true })).toBeFocused();
  await expect(save).toBeInViewport();
  await form.getByText('关联代码版本（1）', { exact: true }).click();
  await expect(choice).toBeChecked();
  await choice.uncheck();
  await form.getByRole('button', { name: '取消', exact: true }).click();
  await expect(old.getByRole('button', { name: '编辑实践', exact: true })).toBeFocused();
  await expect(codeLink).toBeVisible();
  await old.getByRole('button', { name: '编辑实践', exact: true }).click();
  await form.getByText('关联代码版本（1）', { exact: true }).click();
  await choice.uncheck();
  await save.click();
  await expect(old.getByText('实践已保存。', { exact: true })).toBeVisible();
  await expect(codeLink).toHaveCount(0);
  await page.reload();
  await expect(codeLink).toHaveCount(0);

  await recent.getByRole('button', { name: '记录自定义成果', exact: true }).click();
  await form.getByLabel('成果名称').fill('一次保存所有资料');
  await form.getByText('关联学习日志（0）', { exact: true }).click();
  await form.getByRole('checkbox', { name: /点击判断笔记/ }).check();
  await form.getByText('关联知识词条（0）', { exact: true }).click();
  await form.getByRole('checkbox', { name: '点击判断', exact: true }).check();
  await form.getByText('关联代码版本（0）', { exact: true }).click();
  await choice.check();
  await save.click();
  const added = recent.getByRole('article', { name: '一次保存所有资料', exact: true });
  await expect(added.locator('[data-practice-focus]')).toBeFocused();
  await expect(added.getByRole('list', { name: '关联资料' }).getByRole('link')).toHaveCount(3);
  await added.getByRole('link', { name: '代码 · ' + scriptPath, exact: true }).click();
  const backlinks = page.getByRole('region', { name: '引用记录', exact: true });
  await expect(backlinks.getByRole('link', { name: /成长实践 · 一次保存所有资料/ })).toBeVisible();
  await expect(backlinks.getByRole('link', { name: /成长实践 · 点击目标时增加分数/ })).toHaveCount(0);
});

test('完整备份带回本地文本、仅链接版本和关联，v4 继续恢复成长实践', async ({ page, browser }) => {
  await seedStudyContext(page);
  await page.goto('/');
  const { panel, form } = await openLogCodeForm(page);
  await form.getByLabel('项目名称').fill('备份练习');
  await form.getByLabel('本地 .cs 文件').setInputFiles({ name: 'InputManager.cs', mimeType: 'text/plain', buffer: Buffer.from(firstContent) });
  await form.getByLabel('项目内路径（可选）').fill(scriptPath);
  await form.getByLabel('版本说明（可选）').fill('备份里的文本');
  await form.getByRole('button', { name: '保存版本' }).click();
  const savedLocal = panel.getByRole('link', { name: scriptPath, exact: true });
  await expect(savedLocal).toBeVisible();
  const firstHref = await savedLocal.getAttribute('href');
  await panel.getByRole('button', { name: '添加代码版本' }).click();
  await form.getByLabel('GitHub 固定链接').fill(permalink);
  await form.getByLabel('版本说明（可选）').fill('只留固定链接');
  await form.getByRole('button', { name: '保存版本' }).click();
  await expect(panel.getByRole('link', { name: scriptPath, exact: true })).toHaveCount(2);
  const secondHref = await panel.getByRole('link', { name: scriptPath, exact: true }).last().getAttribute('href');
  await page.goto('/#path/click-outcome/first-practice');
  const practice = page.locator('.growth-practices > li').filter({ hasText: '第一次实现点击' });
  await practice.getByRole('button', { name: '编辑实践', exact: true }).click();
  const editor = page.getByRole('form', { name: '实践记录表单' });
  await editor.getByText('关联代码版本（0）', { exact: true }).click();
  await editor.getByRole('checkbox', { name: /备份里的文本/ }).check();
  await editor.getByRole('button', { name: '保存实践', exact: true }).click();
  await expect(practice.getByRole('link', { name: '代码 · ' + scriptPath, exact: true })).toBeVisible();
  await page.goto('/#knowledge/code-entry');
  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  const wordForm = page.getByRole('form', { name: '词条编辑表单' });
  await wordForm.getByText('关联代码版本（0）', { exact: true }).click();
  await wordForm.getByRole('checkbox', { name: /只留固定链接/ }).check();
  await wordForm.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(page.getByRole('region', { name: '项目用例' }).getByRole('link', { name: /只留固定链接/ })).toBeVisible();
  const backup = await downloadBackup(page);
  expect(backup.version).toBe(9);
  expect(backup.data.projectCode.versions.map((version: { content: string | null }) => version.content)).toEqual([firstContent, null]);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    const input = restored.getByLabel('选择备份文件', { exact: true });
    async function select(value: unknown) {
      await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
    }
    async function confirmRestore() {
      await Promise.all([
        restored.waitForEvent('load'),
        restored.getByRole('button', { name: '确认恢复并刷新' }).click(),
      ]);
    }
    const broken = structuredClone(backup);
    broken.data.projectCode.links[0].versionId = 'missing';
    await select(broken);
    await expect(restored.getByText('项目代码数据中存在重复或无效的关联。', { exact: true })).toBeVisible();
    await expect(restored.getByRole('button', { name: '确认恢复并刷新' })).toHaveCount(0);

    await select(backup);
    await expect(restored.getByText('1 个项目、2 个代码版本、4 条代码关联。', { exact: true })).toBeVisible();
    await confirmRestore();
    await restored.goto('/' + firstHref);
    await expect(restored.getByRole('region', { name: '脚本快照' }).locator('pre code')).toContainText('hits = 1');
    await expect(restored.getByRole('link', { name: /学习日志 ·/ })).toBeVisible();
    await expect(restored.getByRole('link', { name: /成长实践 · 点击目标时增加分数/ })).toHaveAttribute('href', '#path/click-outcome/first-practice');
    await restored.goto('/' + secondHref);
    await expect(restored.getByRole('link', { name: '在 GitHub 查看此版本' })).toHaveAttribute('href', permalink);
    await expect(restored.getByRole('link', { name: '知识词条 · 点击判断', exact: true })).toHaveAttribute('href', '#knowledge/code-entry');
    await expect(restored.getByRole('region', { name: '脚本快照' })).toHaveCount(0);
    await expect(restored.getByText(/此版本仅保存链接/)).toBeVisible();
    await restored.goto('/#data');
    const oldBackup = structuredClone(backup);
    oldBackup.version = 4;
    delete oldBackup.data.projectCode;
    delete oldBackup.data.growth.outcomes[0].practices[0].codeVersionIds;
    delete oldBackup.data.knowledge.entries[0].codeVersionIds;
    await select(oldBackup);
    await expect(restored.getByText(/旧备份不包含项目代码/)).toBeVisible();
    await confirmRestore();
    await restored.goto('/#code');
    await expect(restored.getByText(/还没有项目/)).toBeVisible();
    await restored.getByRole('link', { name: '返回成长记录', exact: true }).click();
    await restored.getByRole('link', { name: '点击目标时增加分数', exact: true }).click();
    await expect(restored.getByRole('article', { name: '点击目标时增加分数' })).toContainText('第一次实现点击');
  } finally {
    await context.close();
  }
});

test('已有图片库升级后保留图片，项目代码恢复失败时图片与文字数据一起回退', async ({ page }) => {
  await page.route('**/old-assets-fixture', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto('/old-assets-fixture');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('learning-assistant-assets', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('images', { keyPath: 'id' });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('images', 'readwrite');
      transaction.objectStore('images').put({ id: 'legacy-image', name: 'legacy.png', blob: new Blob(['legacy-image-bytes'], { type: 'image/png' }) });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }));
  await page.goto('/#code');
  await expect(page.getByText(/还没有项目/)).toBeVisible();
  const result = await page.evaluate(async ({ script, code }) => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const { createBackup, restoreBackup } = await import('/src/utils/dataBackup.ts');
    const { readBackupAssets } = await import('/src/utils/projectCodeStorage.ts');
    const id = await useProjectCodeStore.getState().saveVersion({
      project: { name: '回退测试', repositoryUrl: '', tutorialUrl: '' },
      path: script, content: code, githubUrl: '', note: '',
    });
    const before = await createBackup();
    const savedLogs = localStorage.getItem('learning-assistant:study-logs');
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'project-code') throw new DOMException('模拟写入失败', 'QuotaExceededError');
      return put.call(this, value, key);
    };
    let failed = false;
    try {
      await restoreBackup({ ...before, version: 4, images: [], data: { ...before.data, studyLogs: [] } });
    } catch {
      failed = true;
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    const assets = await readBackupAssets();
    return {
      failed,
      imagePreserved: assets.images.length === 1 && assets.images[0].id === 'legacy-image',
      codePreserved: assets.projectCode.versions.length === 1 && assets.projectCode.versions[0].id === id,
      logsPreserved: savedLogs === localStorage.getItem('learning-assistant:study-logs'),
    };
  }, { script: scriptPath, code: firstContent });
  expect(result).toEqual({ failed: true, imagePreserved: true, codePreserved: true, logsPreserved: true });
});

test('实际 Unity 脚本可保存为快照，GitHub 来源保留在备份中', async ({ page }) => {
  const sample = process.env.UNITY_SCRIPT_SAMPLE;
  test.skip(!sample, '设置 UNITY_SCRIPT_SAMPLE 后验证本机 Unity 源文件。');
  const source = process.env.UNITY_CODE_PERMALINK;
  await page.goto('/');
  const { panel, form } = await openLogCodeForm(page);
  await form.getByLabel('项目名称').fill('Whack-a-Mole');
  await form.getByLabel('本地 .cs 文件').setInputFiles(sample!);
  const fileName = path.basename(sample!);
  await form.getByRole('button', { name: '保存版本', exact: true }).click();
  await panel.getByRole('link', { name: fileName, exact: true }).click();
  await expect(page.getByRole('region', { name: '脚本快照' }).locator('pre code.hljs')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '📝 今日学习记录' })).toBeVisible();
  await panel.getByRole('link', { name: fileName, exact: true }).click();
  if (source) {
    await page.getByRole('button', { name: '编辑版本资料', exact: true }).click();
    await page.getByLabel('GitHub 固定链接', { exact: true }).fill(source);
    await page.getByRole('button', { name: '保存版本资料', exact: true }).click();
    await expect(page.getByRole('link', { name: '在 GitHub 查看此版本' })).toHaveAttribute('href', source);
    await expect(page.getByRole('heading', { name: 'Assets/Scripts/' + fileName, exact: true })).toBeVisible();
  }
  const scriptText = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(sample!));
  const identifier = scriptText.match(/\b([A-Za-z_]\w{3,})\s*\(/)?.[1];
  if (identifier) {
    await page.getByRole('button', { name: '检索资料', exact: true }).click();
    const search = page.getByRole('dialog', { name: '检索资料' });
    await search.getByRole('button', { name: '代码版本', exact: true }).click();
    await search.getByRole('checkbox', { name: '搜索脚本正文（本地快照）' }).check();
    await search.getByRole('searchbox').fill(identifier);
    await search.getByRole('link', { name: new RegExp(fileName) }).click();
    await expect(page.getByRole('region', { name: '脚本快照' }).locator('pre code.hljs .search-match').first()).toBeInViewport({ ratio: 1 });
  }
  const backup = await downloadBackup(page);
  const version = backup.data.projectCode.versions[0];
  expect(version.content === scriptText).toBe(true);
  expect(version.githubUrl).toBe(source ?? '');
});
