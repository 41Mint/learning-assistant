import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const knowledgeKey = 'learning-assistant:knowledge';
const logsKey = 'learning-assistant:study-logs';

async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name, exact: true }).click();
}
async function createEntry(page: Page, title: string) {
  await page.getByRole('button', { name: '新建词条', exact: true }).click();
  await page.getByLabel('词条名称（必填）', { exact: true }).fill(title);
  await page.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(page.getByRole('region', { name: '词条详情' }).getByRole('heading', { name: title, exact: true })).toBeVisible();
}
async function seedLogs(page: Page) {
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const store = useStudyLogStore.getState();
    store.appendToDate('2026-10-02', '# Day1 素材处理\n\nPPU 影响世界大小。');
    const first = store.getLogByDate('2026-10-02');
    store.saveLog({ ...first, duration: 50, tags: ['素材'], knowledgePoints: ['PPU'] });
    store.appendToDate('2026-11-04', '# Day2 新的尺寸例子');
  });
}

test('名称即可创建；别名检索、分类、Markdown 编辑及草稿在切换后保留', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#knowledge');
  const accent = await page.evaluate(() => {
    const swatch = document.createElement('span');
    swatch.style.color = 'var(--app-accent)';
    document.body.append(swatch);
    const color = getComputedStyle(swatch).color;
    swatch.remove();
    return color;
  });
  const expectAccentOnFocus = async (input: Locator) => {
    await input.focus();
    await expect(input).toHaveCSS('border-top-color', accent);
  };
  await expectAccentOnFocus(page.getByLabel('搜索名称或别名', { exact: true }));
  await expectAccentOnFocus(page.getByRole('combobox', { name: '词条分类', exact: true }));
  await createEntry(page, 'PPU');
  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  const category = page.getByRole('combobox', { name: '分类（可选）', exact: true });
  await expectAccentOnFocus(page.getByLabel('词条名称（必填）', { exact: true }));
  await expectAccentOnFocus(page.getByLabel('别名（用逗号分隔）', { exact: true }));
  await expectAccentOnFocus(category);
  await expectAccentOnFocus(page.getByLabel('词条正文（Markdown）', { exact: true }));
  await page.getByLabel('别名（用逗号分隔）').fill('Pixels Per Unit，像素单位');
  await category.fill('2D 素材');
  await page.getByLabel('词条正文（Markdown）').fill('## 我的理解\n\n16 像素 / 16 PPU = **1 个世界单位**。');
  await navigate(page, '成长记录');
  await navigate(page, '知识词条');
  await expect(page.getByLabel('词条正文（Markdown）')).toHaveValue(/16 PPU/);
  await page.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(page.locator('.knowledge-entry-content strong')).toHaveText('1 个世界单位');
  await page.getByLabel('搜索名称或别名').fill('pixels per unit');
  await expect(page.locator('.knowledge-entry-list li')).toHaveCount(1);
  await page.getByLabel('搜索名称或别名').fill('unknown');
  await expect(page.locator('.knowledge-entry-list li')).toHaveCount(0);
  await page.getByLabel('搜索名称或别名').fill('');
  await createEntry(page, 'Sprite 切割');
  const categoryFilter = page.getByRole('combobox', { name: '词条分类', exact: true });
  await categoryFilter.fill('2D 素材');
  await categoryFilter.press('ArrowDown');
  await categoryFilter.press('Enter');
  await expect(page.locator('.knowledge-entry-list li')).toHaveCount(1);
  await page.locator('.knowledge-entry-list button').click();
  await page.reload();
  await expect(page.getByRole('region', { name: '词条详情' }).getByRole('heading', { name: 'PPU', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('knowledge-desktop-dark.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('knowledge-mobile-dark.png'), fullPage: true });
});

test('词条共用 Markdown 插入面板，图片跟随正文保存并能在写入失败后重试', async ({ page }) => {
  await page.goto('/#knowledge');
  await createEntry(page, '像素素材');
  await page.evaluate(async () => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    await useProjectCodeStore.getState().saveVersion({
      project: { name: '插入面板示例', repositoryUrl: '', tutorialUrl: '' },
      path: 'Assets/Reader.cs', content: 'class Reader {}', githubUrl: '', note: '',
    });
  });
  await page.getByRole('button', { name: '新建词条', exact: true }).click();
  const form = page.getByRole('form', { name: '词条编辑表单' });
  const menu = form.getByRole('group', { name: '插入到 Markdown' });
  const insert = form.getByRole('button', { name: '插入', exact: true });
  const confirm = menu.getByRole('button', { name: '插入到正文', exact: true });
  const source = form.getByRole('textbox', { name: '词条正文（Markdown）', exact: true });
  await form.getByLabel('词条名称（必填）').fill('素材处理手册');
  await source.fill('相关资料 ');
  await source.click({ button: 'right', position: { x: 70, y: 24 } });
  await menu.getByRole('button', { name: '引用词条', exact: true }).click();
  await menu.getByRole('option', { name: '像素素材', exact: true }).click();
  await confirm.click();
  await source.press('Control+End');
  await source.press('End');
  await page.keyboard.insertText(' ');
  await insert.click();
  await menu.getByRole('button', { name: '引用项目代码', exact: true }).click();
  await menu.getByRole('option', { name: /Reader\.cs/ }).click();
  await confirm.click();
  await insert.click();
  await menu.getByRole('button', { name: '插入表格', exact: true }).click();
  await confirm.click();
  await source.press('Control+End');
  await insert.click();
  await menu.getByRole('button', { name: '插入分隔线', exact: true }).click();
  await insert.click();
  await menu.getByRole('button', { name: '插入图片', exact: true }).click();
  await menu.getByLabel('本地图片（可多选）').setInputFiles({
    name: '素材示意.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfeoAAAAASUVORK5CYII=', 'base64'),
  });
  await confirm.click();

  await form.getByRole('button', { name: '预览', exact: true }).click();
  const preview = form.getByRole('region', { name: '词条正文预览' });
  await expect(preview.getByRole('link', { name: '像素素材', exact: true })).toBeVisible();
  await expect(preview.getByRole('link', { name: 'Reader.cs', exact: true })).toBeVisible();
  await expect(preview.getByRole('table')).toBeVisible();
  await expect(preview.getByRole('separator')).toBeVisible();
  await expect(preview.getByRole('img', { name: '素材示意' })).toBeVisible();
  const savedImages = () => page.evaluate(async () => (await (await import('/src/utils/imageStorage.ts')).getImages()).length);
  expect(await savedImages()).toBe(0);

  await page.evaluate((key) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) {
        Storage.prototype.setItem = setItem;
        throw new Error('模拟词条写入失败');
      }
      setItem.call(this, name, value);
    };
  }, knowledgeKey);
  const save = form.getByRole('button', { name: '保存词条', exact: true });
  await save.click();
  await expect(form.getByRole('alert')).toHaveText('模拟词条写入失败');
  expect(await savedImages()).toBe(0);
  await expect(preview.getByRole('img', { name: '素材示意' })).toBeVisible();
  await save.click();
  const detail = page.getByRole('region', { name: '词条详情' });
  await expect(detail.getByRole('heading', { name: '素材处理手册' })).toBeVisible();
  expect(await savedImages()).toBe(1);
  await page.reload();
  await expect(detail.getByRole('img', { name: '素材示意' })).toBeVisible();
  const data = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), knowledgeKey);
  expect(data.relations).toEqual([]);
  expect(data.entries.find((entry: { title: string }) => entry.title === '素材处理手册').codeVersionIds).toBeUndefined();
});

test('词条分类可新增，旧词条打开下拉时显示全部在用分类', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/#knowledge');
  const form = page.getByRole('form', { name: '词条编辑表单' });
  const category = form.getByRole('combobox', { name: '分类（可选）' });
  const choices = form.getByRole('listbox', { name: '分类（可选）' });
  for (const [title, value] of [['场景空间构建', 'Godot 3D'], ['图形界面', 'Godot UI']]) {
    await page.getByRole('button', { name: '新建词条', exact: true }).click();
    await form.getByLabel('词条名称（必填）').fill(title);
    await category.fill(value);
    await expect(choices.getByText('可直接填写新分类。')).toBeVisible();
    await category.press('Enter');
    await form.getByRole('button', { name: '保存词条' }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }

  await page.getByLabel('搜索名称或别名').fill('场景空间构建');
  await page.getByRole('button', { name: /^场景空间构建/ }).click();
  await page.getByRole('button', { name: '编辑词条' }).click();
  await expect(category).toHaveValue('Godot 3D');
  await category.click();
  await expect(choices.getByRole('option', { name: 'Godot 3D', exact: true })).toBeVisible();
  await expect(choices.getByRole('option', { name: 'Godot UI', exact: true })).toBeVisible();
  const inputBounds = (await category.boundingBox())!;
  const listBounds = (await choices.boundingBox())!;
  expect(Math.abs(listBounds.x - inputBounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(listBounds.width - inputBounds.width)).toBeLessThanOrEqual(1);
  expect(listBounds.y - inputBounds.y - inputBounds.height).toBeCloseTo(4);
  await category.fill('UI');
  await expect(choices.getByRole('option', { name: 'Godot 3D', exact: true })).toHaveCount(0);
  await category.press('ArrowDown');
  await category.press('Enter');
  await expect(category).toHaveValue('Godot UI');
  await form.getByRole('button', { name: '保存词条' }).click();
  await expect(page.getByRole('region', { name: '词条详情' }).getByText('Godot UI', { exact: true })).toBeVisible();
});

test('词条可在正文光标处引用多条日志，解除一条关联后其余引用仍能打开原日志', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#knowledge');
  await seedLogs(page);
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const { appendToDate } = useStudyLogStore.getState();
    for (let day = 1; day <= 12; day++) {
      appendToDate('2026-09-' + String(day).padStart(2, '0'), '# 素材练习');
    }
  });
  await createEntry(page, '像素与世界单位');
  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  const source = page.getByRole('combobox', { name: '引用学习日志', exact: true });
  const list = page.getByRole('listbox', { name: '引用学习日志', exact: true });
  const content = page.getByLabel('词条正文（Markdown）');
  const insert = page.getByRole('button', { name: '插入引用', exact: true });
  const checkAlignment = async () => {
    const field = await source.boundingBox();
    const button = await insert.boundingBox();
    expect(field?.y).toBeCloseTo(button!.y, 0);
    expect(field?.height).toBeCloseTo(button!.height, 0);
  };
  await checkAlignment();
  await content.fill('先处理素材。\n\n再验证尺寸。');
  await content.press('Control+Home');
  await content.press('End');
  await source.click();
  await expect(list.getByRole('option', { name: '2026-10-02 · Day1 素材处理', exact: true })).toBeVisible();
  expect(await list.evaluate((element) => ({
    scrolls: element.scrollHeight > element.clientHeight,
    width: getComputedStyle(element).scrollbarWidth,
    color: getComputedStyle(element).scrollbarColor,
  }))).toEqual({ scrolls: true, width: 'thin', color: await page.locator('html').evaluate((root) => getComputedStyle(root).scrollbarColor) });
  await source.fill('没有这条日志');
  await expect(list.getByRole('status')).toHaveText('没有匹配的资料。');
  await source.fill('2026-10-02 世界大小');
  await expect(list.getByRole('option')).toHaveCount(1);
  await source.press('ArrowDown');
  await source.press('Enter');
  await expect(source).toHaveValue('2026-10-02 · Day1 素材处理');
  await page.getByRole('button', { name: '预览', exact: true }).click();
  await expect(page.getByRole('region', { name: '词条正文预览' })).toContainText('先处理素材。');
  await insert.click();
  await expect(content).toBeFocused();
  await expect(content).toHaveValue(/^先处理素材。\[日志引用\].+\n\n再验证尺寸。$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await checkAlignment();
  await content.press('Control+End');
  await source.fill('尺寸例子');
  await list.getByRole('option', { name: '2026-11-04 · Day2 新的尺寸例子', exact: true }).click();
  await insert.click();
  await page.getByRole('button', { name: '保存词条', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await expect(page.getByRole('link', { name: '日志引用 1', exact: true })).toHaveAttribute('href', '#history/2026-10-02');
  const second = page.getByRole('link', { name: '日志引用 2', exact: true });
  await second.hover();
  await expect(page.getByRole('tooltip')).toHaveText('2026-11-04 · Day2 新的尺寸例子');

  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  await page.getByText('关联学习日志（2）', { exact: true }).click();
  await page.getByRole('checkbox', { name: /Day1 素材处理/ }).uncheck();
  await page.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(page.getByTitle('引用日志暂不可用')).toBeVisible();
  await page.getByRole('link', { name: '日志引用 1', exact: true }).click();
  await expect(page).toHaveURL(/#history\/2026-11-04$/);
  await expect(page.getByRole('heading', { name: 'Day2 新的尺寸例子', exact: true })).toBeVisible();
});

test('旧知识点手动建词条；日志多对多关联、改名、跨月回链和刷新保持正确', async ({ page }) => {
  await page.goto('/');
  await seedLogs(page);
  const original = await page.evaluate((key) => localStorage.getItem(key), logsKey);
  await navigate(page, '历史回顾');
  await page.getByLabel('定位学习日期').fill('2026-10-02');
  const panel = page.locator('#study-history').getByRole('region', { name: '关联知识词条' });
  await panel.getByText('关联已有词条 / 新建词条', { exact: true }).click();
  await panel.getByLabel('关联说明（可选）').fill('初次接触，见 PPU 小节');
  await panel.getByRole('button', { name: '创建并关联：PPU', exact: true }).click();
  await panel.getByLabel('新词条名称').fill('Sprite 切割');
  await panel.getByRole('button', { name: '新建并关联', exact: true }).click();
  await expect(panel.getByRole('link')).toHaveCount(2);
  await panel.getByRole('link', { name: 'PPU', exact: true }).click();
  await expect(page.getByRole('heading', { name: '相关学习记录（1）' })).toBeVisible();
  const entryUrl = page.url();
  await page.locator('.knowledge-sources').getByRole('link', { name: /2026-10-02/ }).click();
  await expect(page.getByLabel('定位学习日期')).toHaveValue('2026-10-02');
  await expect(page.getByRole('heading', { name: '2026 年 10 月', exact: true })).toBeVisible();
  await page.getByLabel('定位学习日期').fill('2026-11-04');
  await panel.getByText('关联已有词条 / 新建词条', { exact: true }).click();
  const picker = panel.getByRole('combobox', { name: '已有词条', exact: true });
  await picker.click();
  await expect(panel.getByRole('option')).toHaveText(['PPU', 'Sprite 切割']);
  await picker.fill('ppu');
  await expect(panel.getByRole('option')).toHaveText(['PPU']);
  await picker.press('ArrowDown');
  await picker.press('Enter');
  await expect(picker).toHaveValue('PPU');
  await picker.fill('没有匹配的词条');
  await expect(panel.getByRole('status')).toHaveText('没有匹配的资料。');
  await picker.press('Escape');
  await expect(picker).toHaveValue('PPU');
  await panel.getByLabel('关联说明（可选）').fill('第二次遇到：32×32 例子');
  await panel.getByRole('button', { name: '关联选中词条 / 更新说明', exact: true }).click();
  await panel.getByRole('button', { name: '关联选中词条 / 更新说明', exact: true }).click();
  await panel.getByRole('link', { name: 'PPU', exact: true }).click();
  await expect(page.getByRole('heading', { name: '相关学习记录（2）' })).toBeVisible();
  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  await page.getByLabel('词条名称（必填）').fill('Pixels Per Unit');
  await page.getByLabel('别名（用逗号分隔）').fill('PPU');
  await page.getByRole('button', { name: '保存词条', exact: true }).click();
  expect(page.url()).toBe(entryUrl);
  await page.locator('.knowledge-sources').getByRole('link', { name: /2026-10-02/ }).click();
  await expect(panel.getByRole('link', { name: 'Pixels Per Unit', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('定位学习日期')).toHaveValue('2026-10-02');
  await expect(panel.getByRole('listitem').filter({ hasText: 'Pixels Per Unit' })).toContainText('初次接触，见 PPU 小节');
  await page.goBack();
  await expect(page.getByRole('region', { name: '词条详情' }).getByRole('heading', { name: 'Pixels Per Unit', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), logsKey)).toBe(original);
});

test('名称/别名冲突阻止保存；相关词条双向且去重；解除及删除保留原日志', async ({ page }) => {
  await page.goto('/#knowledge');
  await seedLogs(page);
  await createEntry(page, 'PPU');
  await createEntry(page, 'Sprite 切割');
  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  await page.getByLabel('别名（用逗号分隔）').fill('ｐｐｕ');
  await page.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '词条名称或别名重复' })).toBeVisible();
  await page.getByRole('button', { name: '取消词条编辑', exact: true }).click();
  const edit = page.getByRole('button', { name: '编辑词条', exact: true });
  const form = page.getByRole('form', { name: '词条编辑表单' });
  const save = form.getByRole('button', { name: '保存词条', exact: true });
  await edit.click();
  await form.getByText('关联其他词条（0）', { exact: true }).click();
  await form.getByRole('checkbox', { name: 'PPU', exact: true }).check();
  await save.click();
  await expect(page.locator('.knowledge-related li')).toHaveCount(1);
  await page.locator('.knowledge-related').getByRole('link', { name: 'PPU', exact: true }).click();
  await expect(page.locator('.knowledge-related').getByRole('link', { name: 'Sprite 切割', exact: true })).toBeVisible();
  await edit.click();
  await form.getByText('关联其他词条（1）', { exact: true }).click();
  await expect(form.getByRole('checkbox', { name: 'PPU', exact: true })).toHaveCount(0);
  await expect(form.getByRole('checkbox', { name: 'Sprite 切割', exact: true })).toBeChecked();
  await form.getByRole('checkbox', { name: 'Sprite 切割', exact: true }).uncheck();
  await save.click();
  await expect(page.locator('.knowledge-related li')).toHaveCount(0);
  await edit.click();
  await form.getByText('关联其他词条（0）', { exact: true }).click();
  await form.getByRole('checkbox', { name: 'Sprite 切割', exact: true }).check();
  await save.click();
  await navigate(page, '历史回顾');
  await page.getByLabel('定位学习日期').fill('2026-10-02');
  const panel = page.locator('#study-history').getByRole('region', { name: '关联知识词条' });
  await panel.getByText('关联已有词条 / 新建词条', { exact: true }).click();
  await panel.getByRole('combobox', { name: '已有词条', exact: true }).click();
  await panel.getByRole('option', { name: 'PPU', exact: true }).click();
  await panel.getByRole('button', { name: '关联选中词条 / 更新说明', exact: true }).click();
  await panel.getByRole('button', { name: '解除与PPU的关联', exact: true }).click();
  await expect(panel.getByRole('link', { name: 'PPU', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: '关联选中词条 / 更新说明', exact: true }).click();
  await panel.getByRole('link', { name: 'PPU', exact: true }).click();
  const beforeLogs = await page.evaluate((key) => localStorage.getItem(key), logsKey);
  await page.getByRole('button', { name: '删除词条', exact: true }).click();
  const deleteEntry = page.getByRole('dialog', { name: '删除词条' });
  await expect(deleteEntry).toContainText('PPU');
  await expect(deleteEntry.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(deleteEntry).toHaveCount(0);
  await page.getByRole('button', { name: '删除词条', exact: true }).click();
  await deleteEntry.getByRole('button', { name: '移入回收站' }).click();
  await expect(deleteEntry).toHaveCount(0);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), knowledgeKey);
  expect(saved.entries.map((entry: { title: string }) => entry.title)).toEqual(['Sprite 切割']);
  expect(saved.logLinks).toHaveLength(0);
  expect(saved.relations).toHaveLength(0);
  expect(saved.trash.entries[0].title).toBe('PPU');
  expect(saved.trash.logLinks).toHaveLength(1);
  expect(saved.trash.relations).toHaveLength(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), logsKey)).toBe(beforeLogs);
});

test('完整备份在独立浏览器恢复词条、说明与双向关联', async ({ page, browser }) => {
  await page.goto('/');
  await seedLogs(page);
  await page.evaluate(async () => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const store = useKnowledgeStore.getState();
    const log = useStudyLogStore.getState().getLogByDate('2026-10-02');
    const a = store.saveEntry({ title: 'PPU', aliases: ['Pixels Per Unit'], category: '2D 素材', content: '我的理解：像素与世界单位的换算。' }, { fromLog: { id: log.id, note: '第一次学习时的例子' } });
    const b = store.saveEntry({ title: 'Sprite 切割', aliases: [], category: '', content: '' });
    store.relate(a, b);
  });
  await navigate(page, '数据管理');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  const download = await downloadEvent;
  const buffer = await readFile((await download.path())!);
  const backup = JSON.parse(buffer.toString('utf8'));
  expect(backup.version).toBe(9);
  expect(backup.data.knowledge.entries).toHaveLength(2);
  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件', { exact: true }).setInputFiles({ name: 'knowledge.json', mimeType: 'application/json', buffer });
    await expect(restored.getByText('2 个知识词条、1 个日志关联、1 个词条间关联。', { exact: true })).toBeVisible();
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新', exact: true }).click()]);
    await navigate(restored, '知识词条');
    await restored.getByLabel('搜索名称或别名').fill('pixels');
    await restored.locator('.knowledge-entry-list button').click();
    await expect(restored.locator('.knowledge-entry-content')).toContainText('像素与世界单位的换算');
    await expect(restored.locator('.knowledge-sources')).toContainText('第一次学习时的例子');
    await expect(restored.locator('.knowledge-related').getByRole('link', { name: 'Sprite 切割', exact: true })).toBeVisible();
    await restored.locator('.knowledge-sources a').click();
    await expect(restored.getByLabel('定位学习日期')).toHaveValue('2026-10-02');
    expect(await restored.evaluate((key) => JSON.parse(localStorage.getItem(key)!), knowledgeKey)).toEqual(backup.data.knowledge);
  } finally { await context.close(); }
});

test('回收站备份保留词条图片和关联，处理别名冲突并清理彻底删除的资料', async ({ page, browser }) => {
  await page.goto('/#knowledge');
  await seedLogs(page);
  const { entryId, peerId, versionId } = await page.evaluate(async () => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const { useGrowthStore } = await import('/src/store/growthStore.ts');
    const { purgeTrashedResource } = await import('/src/store/recycleBin.ts');
    const { writeImages } = await import('/src/utils/imageStorage.ts');
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfeoAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));
    await writeImages(['shared', 'only-entry'].map((id) => ({ id, name: `${id}.png`, blob: new Blob([png], { type: 'image/png' }) })));
    const study = useStudyLogStore.getState();
    const logId = study.getLogByDate('2026-10-02')!.id;
    study.appendToDate('2026-11-04', '![共享示意图](learning-image:shared)');
    const removedLogId = study.getLogByDate('2026-11-04')!.id;
    const knowledge = useKnowledgeStore.getState();
    const entryId = knowledge.saveEntry({ title: 'PPU 实践', aliases: ['像素单位'], category: 'Unity',
      content: '还原原正文。\n\n![共享示意图](learning-image:shared)\n\n![独占示意图](learning-image:only-entry)' }, { fromLog: { id: logId, note: '导入时核对像素大小。' } });
    knowledge.linkLog(entryId, removedLogId, '这一篇将被彻底删除。');
    const peerId = knowledge.saveEntry({ title: '精灵图集', aliases: [], category: 'Unity', content: '![共享示意图](learning-image:shared)' });
    knowledge.relate(entryId, peerId, { label: '互相参照', note: '两者都影响素材处理。' });
    const versionId = await useProjectCodeStore.getState().saveVersion({ project: { name: 'Unity 示例', tutorialUrl: '', repositoryUrl: '' },
      path: 'Assets/SpriteSize.cs', content: 'public class SpriteSize {}', githubUrl: '', note: '' }, { kind: 'entry', id: entryId });
    const growth = useGrowthStore.getState();
    growth.loadGrowth();
    growth.savePractice({ id: 'sprite-scale', title: '核对精灵大小', domains: ['Unity'] },
      { id: 'sprite-practice', date: '2026-10-02', note: '', logIds: [], entryIds: [entryId] });
    knowledge.trashEntry(entryId);
    knowledge.trashEntry(peerId);
    study.trashLog(removedLogId);
    await purgeTrashedResource('log', removedLogId);
    knowledge.saveEntry({ title: '像素单位', aliases: [], category: '', content: '新建词条。' });
    return { entryId, peerId, versionId };
  });
  await page.goto(`/#knowledge/${entryId}`);
  await expect(page.getByRole('link', { name: '打开回收站' })).toBeVisible();
  await page.getByRole('link', { name: '打开回收站' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const buffer = await readFile((await (await downloadEvent).path())!);
  const exported = JSON.parse(buffer.toString('utf8'));
  expect(exported.data.knowledge.trash.logLinks).toHaveLength(1);
  expect(exported.images).toHaveLength(2);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件').setInputFiles({ name: 'trash.json', mimeType: 'application/json', buffer });
    await expect(restored.getByText('回收站中有 2 个词条。')).toBeVisible();
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    const bin = restored.getByRole('region', { name: '回收站' });
    await bin.getByRole('link', { name: '词条', exact: true }).click();
    const row = (name: string) => bin.getByRole('listitem').filter({ hasText: name });
    await row('PPU 实践').getByRole('button', { name: '恢复词条' }).click();
    const confirm = restored.getByRole('button', { name: '确认恢复' });
    await expect(confirm).toBeDisabled();
    await restored.getByLabel(/别名（/).fill('像素尺寸');
    await confirm.click();
    await bin.getByRole('link', { name: 'PPU 实践' }).click();
    await expect(restored).toHaveURL(new RegExp(`#knowledge/${entryId}$`));
    await expect(restored.getByText('还原原正文。')).toBeVisible();
    await expect(restored.getByRole('img', { name: '独占示意图' })).toBeVisible();
    await expect(restored.getByText('导入时核对像素大小。')).toBeVisible();
    await expect(restored.getByRole('link', { name: /SpriteSize\.cs/ })).toBeVisible();
    await expect(restored.getByRole('link', { name: '精灵图集' })).toHaveCount(0);
    await restored.goto('/#data?trash=entry');
    await row('精灵图集').getByRole('button', { name: '恢复词条' }).click();
    await confirm.click();
    await bin.getByRole('link', { name: '精灵图集' }).click();
    await expect(restored).toHaveURL(new RegExp(`#knowledge/${peerId}$`));
    await restored.getByRole('link', { name: 'PPU 实践' }).click();
    await expect(restored.getByRole('link', { name: '精灵图集' })).toBeVisible();
    await restored.getByRole('button', { name: '删除词条', exact: true }).click();
    await restored.getByRole('button', { name: '移入回收站' }).click();
    await restored.getByRole('link', { name: '打开回收站' }).click();
    await row('PPU 实践').getByRole('button', { name: '彻底删除' }).click();
    await restored.getByRole('button', { name: '确认彻底删除' }).click();
    await expect(bin.getByText('回收站为空。')).toBeVisible();
    const after = await restored.evaluate(async () => {
      const { createBackup } = await import('/src/utils/dataBackup.ts');
      return createBackup();
    });
    expect(after.images.map(({ id }) => id)).toEqual(['shared']);
    expect(after.data.knowledge.trash.relations).toHaveLength(0);
    expect(after.data.growth.outcomes[0].practices[0].entryIds).toHaveLength(0);
    expect(after.data.projectCode.versions[0].id).toBe(versionId);
    expect(after.data.projectCode.links).toHaveLength(0);
  } finally { await context.close(); }
});

test('旧 v1/v2 备份兼容；孤立/重复关联拒绝；词条持久化失败与恢复失败不破坏旧数据', async ({ page }) => {
  await page.goto('/');
  await seedLogs(page);
  const results = await page.evaluate(async () => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const { createBackup, parseBackup, restoreBackup } = await import('/src/utils/dataBackup.ts');
    const store = useKnowledgeStore.getState();
    const log = useStudyLogStore.getState().getLogByDate('2026-10-02');
    const id = store.saveEntry({ title: 'PPU', aliases: [], category: '', content: '' }, { fromLog: { id: log.id, note: '' } });
    const backup = await createBackup();
    const old1 = parseBackup({ ...backup, version: 1, images: undefined, data: { ...backup.data, knowledge: undefined } });
    const old2 = parseBackup({ ...backup, version: 2, data: { ...backup.data, knowledge: undefined } });
    const { trash: _trash, ...oldKnowledge } = backup.data.knowledge;
    if (parseBackup({ ...backup, version: 6, data: { ...backup.data, knowledge: oldKnowledge } }).data.knowledge.trash.entries.length) {
      throw new Error('v6 备份应以空词条回收站恢复。');
    }
    const invalid = [
      { ...backup.data.knowledge, logLinks: [{ id: 'missing', entryId: id, logId: 'missing', note: '' }] },
      { ...backup.data.knowledge, logLinks: [...backup.data.knowledge.logLinks, { ...backup.data.knowledge.logLinks[0], id: 'duplicate' }] },
      { ...backup.data.knowledge, relations: [{ id: 'self', sourceId: id, targetId: id }] },
      { ...backup.data.knowledge, relations: [{ id: 'missing', sourceId: id, targetId: 'missing' }] },
      { ...backup.data.knowledge, entries: [{ ...backup.data.knowledge.entries[0], content: '![missing](learning-image:missing)' }] },
    ];
    const rejected = invalid.every((knowledge) => {
      try { parseBackup({ ...backup, data: { ...backup.data, knowledge } }); return false; } catch { return true; }
    });
    const keys = ['learning-assistant:knowledge', 'learning-assistant:study-logs'];
    const before = keys.map((key) => localStorage.getItem(key));
    const original = Storage.prototype.setItem;
    let failedOnce = false;
    Storage.prototype.setItem = function (key, value) {
      if (key === keys[0] && !failedOnce) { failedOnce = true; throw new DOMException('quota', 'QuotaExceededError'); }
      return original.call(this, key, value);
    };
    let saveFailed = false;
    try { store.saveEntry({ title: '未保存', aliases: [], category: '', content: '' }); } catch { saveFailed = true; }
    const inMemoryUnchanged = useKnowledgeStore.getState().entries.length === 1;
    failedOnce = false;
    let rolledBack = false;
    try { await restoreBackup({ ...backup, data: { ...backup.data, studyLogs: [] , knowledge: { version: 1, entries: [], logLinks: [], relations: [] } } }); } catch { rolledBack = true; }
    Storage.prototype.setItem = original;
    return { old1: old1.data.knowledge.entries.length, old2: old2.data.knowledge.entries.length, rejected, saveFailed, inMemoryUnchanged, rolledBack,
      unchanged: keys.every((key, index) => localStorage.getItem(key) === before[index]) };
  });
  expect(results).toEqual({ old1: 0, old2: 0, rejected: true, saveFailed: true, inMemoryUnchanged: true, rolledBack: true, unchanged: true });
});
