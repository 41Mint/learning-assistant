import { expect, test } from '@playwright/test';

test('今日日志的标签与知识点可用键盘或按钮添加并分别移除', async ({ page }) => {
  await page.goto('/#today');
  const tags = page.getByRole('region', { name: '标签', exact: true });
  const points = page.getByRole('region', { name: '学到的知识点', exact: true });
  const tag = tags.getByRole('textbox', { name: '标签', exact: true });
  await tag.fill('  小型练习  ');
  await tag.press('Enter');
  const removeTag = tags.getByRole('button', { name: '移除标签「小型练习」' });
  await expect(removeTag).toBeVisible();
  await expect(tag).toHaveValue('');
  await points.getByRole('textbox').fill('坐标转换');
  await points.getByRole('button', { name: '添加学到的知识点' }).click();
  const removePoint = points.getByRole('button', { name: '移除学到的知识点「坐标转换」' });
  await expect(removePoint).toBeVisible();
  await removeTag.click();
  await expect(removeTag).toHaveCount(0);
  await expect(removePoint).toBeVisible();
  await removePoint.click();
  await expect(removePoint).toHaveCount(0);
});

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
  const history = page.locator('#study-history');
  await nav.getByRole('link', { name: '历史回顾' }).click();
  await page.getByLabel('定位学习日期').fill('2026-11-04');
  const expand = page.getByRole('button', { name: '展开全文', exact: true });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect((await history.locator('.collapsible-note-window').boundingBox())!.height).toBeLessThanOrEqual(320);
  await history.locator('.collapsible-note').screenshot({ path: testInfo.outputPath('history-preview-dark.png') });
  await expand.click();
  await expect(page.getByRole('button', { name: '收起正文', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await history.locator('.collapsible-note-window').boundingBox())?.height ?? 0).toBeGreaterThan(320);
  await nav.getByRole('link', { name: '成长记录' }).click();
  await nav.getByRole('link', { name: '历史回顾' }).click();
  await expect(page.getByRole('button', { name: '收起正文', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '收起并返回正文开头', exact: true }).click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  await expect(page.getByLabel('定位学习日期')).toBeHidden();
  await expect(page.getByRole('complementary', { name: '学习统计与打卡' })).toBeHidden();
  await expect(page.getByRole('heading', { name: '编辑历史记录', exact: true })).toBeFocused();
  await expect(page.getByLabel('历史学习内容', { exact: true })).toHaveValue(/待补充的问题/);
  await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  await page.getByLabel('定位学习日期').fill('2026-11-03');
  await expect(history.locator('.collapsible-note')).toContainText('今天只有一条简短笔记。');
  await expect(expand).toHaveCount(0);
});

test('学习历史的日历操作、统计折线和打卡卡片适配窄屏', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/?workspace=knowledge-demo#history');
  const calendar = page.getByRole('group', { name: '切换月份' });
  const initialMonth = await calendar.getByRole('heading').textContent();
  await calendar.getByRole('button', { name: '← 上月' }).click();
  await expect(calendar.getByRole('heading')).not.toHaveText(initialMonth!);
  await calendar.getByRole('button', { name: '下月 →' }).click();
  await expect(calendar.getByRole('heading')).toHaveText(initialMonth!);
  await calendar.getByRole('button', { name: '今天', exact: true }).click();
  const stats = page.getByRole('complementary', { name: '学习统计与打卡' });
  await expect(stats.locator('.recharts-line-curve')).toHaveCount(2);
  await expect(stats.getByText('最长连续', { exact: true })).toBeVisible();
  expect(await stats.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await stats.screenshot({ path: testInfo.outputPath('history-stats-dark-mobile.png') });
});

test('日志的词条关联区在展开和收起时有过渡，并尊重减少动态效果设置', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#today');
  const panel = page.locator('.study-log-card .knowledge-log-links details');
  await expect(panel).toBeVisible();
  const motion = await panel.evaluate(async (element: HTMLDetailsElement) => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await frame();
    await frame();
    const measure = async (open: boolean) => {
      const before = element.getBoundingClientRect().height;
      element.open = open;
      const start = performance.now();
      const sizes: number[] = [];
      while (performance.now() - start < 300) {
        await frame();
        sizes.push(element.getBoundingClientRect().height);
      }
      const after = element.getBoundingClientRect().height;
      const smaller = Math.min(before, after);
      const larger = Math.max(before, after);
      return { before, after, animated: sizes.some((size) => smaller + 1 < size && size < larger - 1) };
    };
    return { opening: await measure(true), closing: await measure(false) };
  });
  expect(motion.opening.animated, JSON.stringify(motion)).toBe(true);
  expect(motion.opening.after).toBeGreaterThan(motion.opening.before);
  expect(motion.closing.animated).toBe(true);
  expect(motion.closing.after).toBeLessThan(motion.closing.before);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element, '::details-content').transitionDuration))
    .toMatch(/^0s(?:, 0s)*$/);
});
