import { expect, test } from '@playwright/test';

test('明暗主题与桌面/窄屏下编辑框和预览框等高，桌面上下对齐', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    useStudyLogStore.getState().updateContent('# Day1 学习记录\n\n' + 'PPU 素材设置和学习观察。\n\n'.repeat(40));
  });
  await page.locator('.study-log-card').getByRole('button', { name: '编辑', exact: true }).click();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const editor = await page.locator('#study-log-content').boundingBox();
      const preview = await page.getByRole('region', { name: '学习内容实时预览' }).boundingBox();
      expect(Math.abs(editor!.height - preview!.height)).toBeLessThanOrEqual(1);
      if (width > 1180) expect(Math.abs(editor!.y - preview!.y)).toBeLessThanOrEqual(1);
      expect(await page.locator('#study-log-content').evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      expect(await page.getByRole('region', { name: '学习内容实时预览' }).evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.editor-grid').screenshot({ path: testInfo.outputPath('editor-alignment-dark.png') });
});

test('历史长文默认预览，可展开/收起；短文完整显示，编辑不受折叠影响', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    useStudyLogStore.getState().appendToDate('2026-11-04', '# 素材处理记录\n\n' + '学习操作、参数情境和待补充的问题。\n\n'.repeat(40));
    useStudyLogStore.getState().appendToDate('2026-11-03', '今天只有一条简短笔记。');
  });
  const nav = page.getByRole('navigation', { name: '主要功能' });
  await nav.getByRole('link', { name: '历史回顾' }).click();
  await page.getByLabel('定位学习日期').fill('2026-11-04');
  const expand = page.getByRole('button', { name: '展开全文', exact: true });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect((await page.locator('.collapsible-note-window').boundingBox())!.height).toBeLessThanOrEqual(320);
  await page.locator('.collapsible-note').screenshot({ path: testInfo.outputPath('history-preview-dark.png') });
  await expand.click();
  await expect(page.getByRole('button', { name: '收起正文', exact: true })).toHaveAttribute('aria-expanded', 'true');
  expect((await page.locator('.collapsible-note-window').boundingBox())!.height).toBeGreaterThan(320);
  await nav.getByRole('link', { name: '成长记录' }).click();
  await nav.getByRole('link', { name: '历史回顾' }).click();
  await expect(page.getByRole('button', { name: '收起正文', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '收起并返回正文开头', exact: true }).click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  await expect(page.getByLabel('历史学习内容')).toHaveValue(/待补充的问题/);
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await page.getByLabel('定位学习日期').fill('2026-11-03');
  await expect(page.locator('.collapsible-note')).toContainText('今天只有一条简短笔记。');
  await expect(expand).toHaveCount(0);
});
