import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function navigate(page: Page, label: string) {
  const link = page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: label, exact: true });
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
}

test('主要入口分开呈现，刷新和浏览器前后退保留入口', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '📝 今日学习记录' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '📅 学习历史' })).toBeHidden();
  await navigate(page, '成长记录');
  await expect(page).toHaveURL(/#path$/);
  await expect(page.getByRole('heading', { name: '最近做到' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '📝 今日学习记录' })).toBeHidden();
  await navigate(page, '数据管理');
  await expect(page.getByRole('button', { name: '导出完整备份', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#path$/);
  await page.goForward();
  await expect(page).toHaveURL(/#data$/);
  await page.reload();
  await expect(page.getByRole('button', { name: '导出完整备份', exact: true })).toBeVisible();
});

test('切换入口持续计时，回到今日不重置且不会重复记时长', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await page.getByRole('button', { name: '▶️ 开始', exact: true }).click();
  await page.clock.runFor(2000);
  await expect(page.getByTestId('timer-display')).toHaveText('24:58');
  await navigate(page, '成长记录');
  await page.clock.runFor(3000);
  await expect(page.locator('.session-status')).toContainText('24:55');
  await navigate(page, '历史回顾');
  await page.clock.runFor(2000);
  await navigate(page, '今日学习');
  await expect(page.getByTestId('timer-display')).toHaveText('24:53');
  const duration = await page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:study-logs') ?? '[]').reduce((sum: number, log: { duration: number }) => sum + log.duration, 0));
  expect(duration).toBe(0);
});

test('今日正文使用草稿，编辑期间计时可继续，取消与保存结果明确', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await page.getByRole('button', { name: '▶️ 开始', exact: true }).click();
  const edit = page.locator('.study-log-card').getByRole('button', { name: '编辑', exact: true });
  await edit.click();
  const editor = page.getByRole('form', { name: '今日记录编辑表单' });
  await expect(page.locator('.learning-import')).toBeHidden();
  await expect(page.getByTestId('timer-display')).toBeHidden();
  await page.clock.runFor(2000);
  await expect(page.locator('.session-status')).toContainText('24:58');
  await page.getByRole('button', { name: '暂停计时', exact: true }).click();
  await editor.getByLabel('学习内容（Markdown）').fill('这份草稿要取消。');
  await navigate(page, '成长记录');
  await navigate(page, '今日学习');
  await expect(editor.getByLabel('学习内容（Markdown）')).toHaveValue('这份草稿要取消。');
  await editor.getByRole('button', { name: '取消编辑', exact: true }).click();
  await expect(page.locator('.study-log-card')).not.toContainText('这份草稿要取消。');
  await expect(page.getByTestId('timer-display')).toHaveText('24:58');
  await edit.click();
  await editor.getByLabel('学习内容（Markdown）').fill('## 本次记录已保存');
  await editor.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '本次记录已保存', exact: true })).toBeVisible();
});

test('历史草稿在切换入口后保留，长笔记可用固定导航直接离开', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    useStudyLogStore.getState().appendToDate('2026-11-04', '# 回看笔记\n\n' + '学习步骤\n\n'.repeat(100));
  });
  await navigate(page, '历史回顾');
  await page.getByLabel('定位学习日期').fill('2026-11-04');
  await page.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  await page.getByLabel('历史学习内容', { exact: true }).fill('尚未保存的补充内容');
  await navigate(page, '数据管理');
  await navigate(page, '历史回顾');
  await expect(page.getByLabel('历史学习内容', { exact: true })).toHaveValue('尚未保存的补充内容');
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const navigationBox = await page.getByRole('navigation', { name: '主要功能' }).boundingBox();
  expect(navigationBox?.y).toBeLessThan(20);
  await navigate(page, '数据管理');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('窄屏六个入口可操作，页面无横向溢出', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const label of ['今日学习', '成长记录', '历史回顾', '知识词条', '知识网络', '数据管理']) {
    await navigate(page, label);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('mobile-data.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate(page, '历史回顾');
  await page.screenshot({ path: testInfo.outputPath('desktop-history.png') });
  await navigate(page, '今日学习');
  await page.screenshot({ path: testInfo.outputPath('desktop-today.png') });
});
