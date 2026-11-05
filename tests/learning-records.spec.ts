import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const day = '2026-11-04';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfeoAAAAASUVORK5CYII=', 'base64');
const markdown = '# 学习步骤\n\nPPU 笔记\n\n![示意截图](images/step.png)\n\n[文档](https://docs.unity3d.com/)';

async function openImport(page: Page, content = markdown) {
  await page.goto('/');
  await page.getByText('导入图文学习记录（Markdown + 图片）', { exact: true }).click();
  await page.getByLabel('导入学习日期').fill(day);
  await page.getByLabel('Markdown 文件', { exact: true }).setInputFiles({ name: '学习整理.md', mimeType: 'text/markdown', buffer: Buffer.from(content) });
}

async function importNote(page: Page) {
  await openImport(page);
  await page.getByLabel('配套图片', { exact: true }).setInputFiles({ name: 'step.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '检查并预览', exact: true }).click();
  await expect(page.locator('.import-preview img')).toHaveCount(1);
  await page.getByRole('button', { name: '保存到该日期', exact: true }).click();
  await expect(page.getByText(`已保存到 ${day} 的学习记录`, { exact: false })).toBeVisible();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾' }).click();
  await page.getByLabel('定位学习日期').fill(day);
  await expect(page.locator('#study-history .markdown-preview img')).toHaveCount(1);
  await expect.poll(() => page.locator('#study-history .markdown-preview img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
}

test('缺图阻止保存；代码块里的图片语法不当作实际图片', async ({ page }) => {
  await openImport(page, `${markdown}\n\n\x60\x60\x60md\n![code](missing-code.png)\n\x60\x60\x60`);
  await page.getByRole('button', { name: '检查并预览', exact: true }).click();
  await expect(page.getByText('未匹配：images/step.png', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存到该日期', exact: true })).toBeDisabled();
  await expect(page.locator('.import-errors li')).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:study-logs') ?? '[]').some((log: { date: string }) => log.date === '2026-11-04'))).toBe(false);
});

test('图片刷新后可读；历史补充及追加不覆盖旧正文和时长，今日计时独立', async ({ page }) => {
  await importNote(page);
  await page.reload();
  await page.getByLabel('定位学习日期').fill(day);
  await expect.poll(() => page.locator('#study-history .markdown-preview img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  const editor = page.getByLabel('历史学习内容', { exact: true });
  await editor.fill(`${await editor.inputValue()}\n\n补充：32×32 素材的新例子。`);
  await page.getByRole('button', { name: '保存补充', exact: true }).click();
  await expect(page.locator('#study-history')).toContainText('补充：32×32 素材的新例子。');
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const store = useStudyLogStore.getState();
    const log = store.getLogByDate('2026-11-04');
    store.saveLog({ ...log, duration: 50 });
    store.appendToDate('2026-11-04', '第二次学习内容');
    store.addDuration(25, '目标：今日任务');
  });
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:study-logs') ?? '[]'));
  const historical = logs.find((log: { date: string }) => log.date === day);
  expect(historical.duration).toBe(50);
  expect(historical.content).toContain('补充：32×32');
  expect(historical.content).toContain('第二次学习内容');
  expect(logs.find((log: { tags: string[] }) => log.tags.includes('目标：今日任务')).duration).toBe(25);
  await page.reload();
  await page.getByLabel('定位学习日期').fill(day);
  await expect(page.locator('#study-history')).toContainText('第二次学习内容');
});

test('新版备份包含真实图片；取消无写入；确认恢复后图文一致', async ({ page }) => {
  await importNote(page);
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '数据管理' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  const download = await downloadEvent;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.version).toBe(2);
  expect(backup.images).toHaveLength(1);
  expect(Buffer.from(backup.images[0].base64, 'base64').equals(png)).toBe(true);
  const file = { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) };
  await page.getByLabel('选择备份文件', { exact: true }).setInputFiles(file);
  const before = await page.evaluate(() => localStorage.getItem('learning-assistant:study-logs'));
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('learning-assistant:study-logs'))).toBe(before);
  await page.evaluate(async () => {
    const { writeImages } = await import('/src/utils/imageStorage.ts');
    await writeImages([], true);
    localStorage.setItem('learning-assistant:study-logs', '[]');
    localStorage.setItem('learning-assistant:log:2000-01-01', JSON.stringify({ duration: 500 }));
  });
  await page.getByLabel('选择备份文件', { exact: true }).setInputFiles(file);
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: '确认恢复并刷新', exact: true }).click(),
  ]);
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾' }).click();
  await page.getByLabel('定位学习日期').fill(day);
  await page.locator('#study-history .markdown-preview img').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('#study-history .markdown-preview img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('learning-assistant:log:2000-01-01'))).toBeNull();
});

test('旧备份可读取，损坏备份无写入，写入失败可回退', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { createBackup, parseBackup, restoreBackup } = await import('/src/utils/dataBackup.ts');
    const backup = await createBackup();
    const old = parseBackup({ ...backup, version: 1, images: undefined });
    const before = localStorage.getItem('learning-assistant:study-logs');
    let rejected = false;
    try { parseBackup({ ...backup, data: { ...backup.data, studyLogs: [{}] } }); } catch { rejected = true; }
    const original = Storage.prototype.setItem;
    let failedOnce = false;
    Storage.prototype.setItem = function (key, value) {
      if (!failedOnce && key === 'learning-assistant:study-logs') { failedOnce = true; throw new DOMException('quota', 'QuotaExceededError'); }
      return original.call(this, key, value);
    };
    let rolledBack = false;
    try { await restoreBackup(backup); } catch { rolledBack = true; }
    finally { Storage.prototype.setItem = original; }
    return { oldVersion: old.version, rejected, rolledBack, unchanged: before === localStorage.getItem('learning-assistant:study-logs') };
  });
  expect(result).toEqual({ oldVersion: 1, rejected: true, rolledBack: true, unchanged: true });
});

test('Day1 真实材料：15 张图片的导入、刷新和备份', async ({ page }, testInfo) => {
  const source = process.env.DAY1_NOTE;
  test.skip(!source, '设置 DAY1_NOTE 后使用本机真实学习材料验证，不把个人材料放入仓库。');
  const directory = path.dirname(source!);
  const files = (await readdir(path.join(directory, 'images'))).map((name) => path.join(directory, 'images', name));
  await openImport(page, await readFile(source!, 'utf8'));
  await page.getByLabel('配套图片', { exact: true }).setInputFiles(files);
  await page.getByRole('button', { name: '检查并预览', exact: true }).click();
  await expect(page.locator('.import-preview img')).toHaveCount(15);
  await page.locator('.learning-import').screenshot({ path: testInfo.outputPath('day1-import.png') });
  await page.getByRole('button', { name: '保存到该日期', exact: true }).click();
  await page.reload();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾' }).click();
  await page.getByLabel('定位学习日期').fill(day);
  await page.getByRole('button', { name: '展开全文', exact: true }).click();
  await expect(page.locator('#study-history .markdown-preview img')).toHaveCount(15);
  for (const image of await page.locator('#study-history .markdown-preview img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await expect.poll(() => page.locator('#study-history .markdown-preview img').evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  const counts = await page.evaluate(async () => {
    const { createBackup } = await import('/src/utils/dataBackup.ts');
    const backup = await createBackup();
    return { images: backup.images.length, references: backup.data.studyLogs.find((log) => log.date === '2026-11-04')!.content.match(/learning-image:/g)?.length };
  });
  expect(counts).toEqual({ images: 15, references: 15 });
  await page.getByLabel('定位学习日期').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('day1-history.png') });
});
