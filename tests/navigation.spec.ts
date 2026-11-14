import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function navigate(page: Page, label: string) {
  const navigation = page.getByRole('navigation', { name: '主要功能' });
  const menu = navigation.getByRole('button', { name: '页面菜单' });
  const compact = await menu.isVisible();
  if (compact) await menu.click();
  const link = navigation.getByRole('link', { name: label, exact: true });
  await link.click();
  if (compact) {
    await expect(menu).toContainText(label);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  } else {
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
}

test('主要入口分开呈现，刷新和浏览器前后退保留入口', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '📝 今日学习记录' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '📅 学习历史' })).toBeHidden();
  await navigate(page, '成长记录');
  await expect(page).toHaveURL(/#path$/);
  await expect(page.getByRole('region', { name: '已完成' })).toBeVisible();
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
  expect(navigationBox?.y).toBeLessThanOrEqual(56);
  await navigate(page, '数据管理');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('窄屏六个入口可操作，页面无横向溢出', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '主要功能' });
  const menu = nav.getByRole('button', { name: '页面菜单' });
  await expect(nav.getByRole('link')).toHaveCount(0);
  await expect(nav.getByRole('button', { name: '检索资料' })).toBeVisible();
  const closed = (await nav.boundingBox())!;
  await menu.press('Enter');
  await expect(nav.getByRole('link')).toHaveCount(8);
  expect((await nav.boundingBox())!.height).toBe(closed.height);
  await page.screenshot({ path: testInfo.outputPath('mobile-menu.png') });
  await nav.getByRole('link', { name: '历史回顾', exact: true }).press('Escape');
  await expect(menu).toBeFocused();
  await expect(nav.getByRole('link')).toHaveCount(0);
  await menu.click();
  await nav.getByRole('button', { name: '关闭页面菜单', exact: true }).click({ position: { x: 370, y: 300 } });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
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

test('贴左图标侧栏悬停覆盖展开，子页支持刷新和历史记录', async ({ page }, testInfo) => {
  await page.goto('/#today');
  const nav = page.getByRole('navigation', { name: '主要功能' });
  const growth = nav.getByRole('link', { name: '成长记录', exact: true });
  const group = nav.getByRole('group', { name: '成长记录子页' });
  await expect(group.getByRole('link')).toHaveCount(2);
  const compact = (await nav.boundingBox())!;
  expect(compact).toMatchObject({ x: 0, y: 56, width: 58 });
  const main = page.getByRole('main');
  const original = await main.boundingBox();
  await expect(group.getByText('项目代码')).toBeHidden();
  await expect(group.getByRole('link', { name: '项目代码' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop-rail.png') });
  await growth.hover();
  await expect(group.getByText('项目代码')).toBeVisible();
  expect((await nav.boundingBox())?.width).toBeGreaterThan(compact.width);
  expect(await main.boundingBox()).toEqual(original);
  await page.screenshot({ path: testInfo.outputPath('desktop-rail-expanded.png') });
  await page.mouse.move(400, 100);
  await expect(group.getByText('项目代码')).toBeHidden();
  expect(await main.boundingBox()).toEqual(original);
  await page.getByRole('link', { name: '游戏开发学习助手首页' }).focus();
  await page.keyboard.press('Tab');
  await expect(group.getByText('项目代码')).toBeVisible();
  const topics = nav.getByRole('link', { name: '参考路径与任务', exact: true });
  await topics.click();
  await expect(page).toHaveURL(/#path\/topics$/);
  await expect(group.getByText('参考路径与任务')).toBeHidden();
  await page.reload();
  await expect(topics).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('region', { name: '参考路径与任务' })).toBeVisible();
  await nav.getByRole('link', { name: '项目代码', exact: true }).click();
  await expect(page).toHaveURL(/#code$/);
  await page.goBack();
  await expect(topics).toHaveAttribute('aria-current', 'page');
});
