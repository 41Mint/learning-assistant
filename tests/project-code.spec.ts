import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectCodeData } from '../src/types/projectCode';

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
  await page.getByRole('button', { name: '导入项目目录', exact: true }).click();
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
  await panel.getByRole('combobox').selectOption(saved.id);
  await panel.getByRole('button', { name: '关联所选版本' }).click();
  await panel.getByRole('link', { name: scriptPath, exact: true }).click();
  await expect(page.getByRole('link', { name: /学习日志 ·/ })).toHaveAttribute('href', '#history/' + firstDate);
  await page.goto('/#code');

  await project.getByRole('button', { name: '更新目录快照' }).click();
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
  expect(backup.version).toBe(5);
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
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除代码版本', exact: true }).click();
  await expect(page.getByRole('article', { name: '打地鼠练习' })).toContainText('1 个代码版本');
  await page.goto('/#history/' + firstDate);
  await expect(page.getByRole('region', { name: '项目代码', exact: true }).getByText('项目代码（0）', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '点击判断笔记' })).toBeVisible();
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
  const old = page.getByRole('article', { name: '点击目标时增加分数' }).locator('.growth-practices > li').filter({ hasText: '第一次实现点击' });
  const codeLink = old.getByRole('link', { name: '代码 · ' + scriptPath, exact: true });
  await expect(codeLink).toHaveAttribute('href', '#code/' + versionId);
  const recent = page.getByRole('region', { name: '最近做到' });
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
  await expect(added.getByRole('link')).toHaveCount(3);
  await added.getByRole('link', { name: '代码 · ' + scriptPath, exact: true }).click();
  const backlinks = page.getByRole('region', { name: '引用记录', exact: true });
  await expect(backlinks.getByRole('link', { name: /成长实践 · 一次保存所有资料/ })).toBeVisible();
  await expect(backlinks.getByRole('link', { name: /成长实践 · 点击目标时增加分数/ })).toHaveCount(0);
});

test('v5 备份带回本地文本、仅链接版本和关联，v4 继续恢复成长实践', async ({ page, browser }) => {
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
  await page.goto('/#path');
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
  expect(backup.version).toBe(5);
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
