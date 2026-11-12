import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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
  await page.goto('/#knowledge');
  await createEntry(page, 'PPU');
  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  await page.getByLabel('别名（用逗号分隔）').fill('Pixels Per Unit，像素单位');
  await page.getByLabel('分类（可选）').fill('2D 素材');
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
  await page.getByRole('combobox', { name: '词条分类', exact: true }).selectOption({ label: '2D 素材' });
  await expect(page.locator('.knowledge-entry-list li')).toHaveCount(1);
  await page.locator('.knowledge-entry-list button').click();
  await page.reload();
  await expect(page.getByRole('region', { name: '词条详情' }).getByRole('heading', { name: 'PPU', exact: true })).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('knowledge-desktop-dark.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('knowledge-mobile-dark.png'), fullPage: true });
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
  await panel.getByLabel('已有词条', { exact: true }).selectOption({ label: 'PPU' });
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
  await panel.getByLabel('已有词条', { exact: true }).selectOption({ label: 'PPU' });
  await panel.getByRole('button', { name: '关联选中词条 / 更新说明', exact: true }).click();
  await panel.getByRole('button', { name: '解除与PPU的关联', exact: true }).click();
  await expect(panel.getByRole('link', { name: 'PPU', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: '关联选中词条 / 更新说明', exact: true }).click();
  await panel.getByRole('link', { name: 'PPU', exact: true }).click();
  const beforeLogs = await page.evaluate((key) => localStorage.getItem(key), logsKey);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除词条', exact: true }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), knowledgeKey);
  expect(saved.entries.map((entry: { title: string }) => entry.title)).toEqual(['Sprite 切割']);
  expect(saved.logLinks).toHaveLength(0);
  expect(saved.relations).toHaveLength(0);
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
  expect(backup.version).toBe(5);
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
