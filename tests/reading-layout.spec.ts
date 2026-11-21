import { expect, test } from '@playwright/test';

test('插入代码引用收起时保留动画内容，结束后退出键盘焦点顺序', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#today');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const summary = page.getByText('插入代码引用', { exact: true });
  await summary.click();
  const picker = page.getByRole('combobox', { name: '引用代码版本', exact: true });
  await expect(picker).toBeVisible();
  await summary.click();
  const details = page.locator('details').filter({ has: summary });
  await expect(details.locator('input[role="combobox"]')).toHaveCount(1);
  await expect(details.locator('input[role="combobox"]')).toBeHidden();
  await expect(summary).toBeFocused();
});

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

test('今日和历史日志可双击改标签，保存排序并拒绝空值或重名', async ({ page }) => {
  const date = '2026-11-05';
  await page.goto('/#today');
  await page.evaluate(async (date) => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const store = useStudyLogStore.getState();
    for (const tag of ['Unity', '2D物理', 'Input System']) store.addTag(tag);
    store.appendToDate(date, '历史日志正文。');
    const log = store.getLogByDate(date)!;
    store.changeTag(log.id, '历史标签', true);
  }, date);
  const today = page.getByRole('region', { name: '标签', exact: true });
  const physics = today.getByRole('button', { name: '编辑标签「2D物理」', exact: true });
  const editor = today.getByRole('textbox', { name: '编辑标签「2D物理」', exact: true });
  await physics.click();
  await expect(editor).toHaveCount(0);
  await physics.dblclick();
  await expect(editor).toBeFocused();
  await editor.fill(' ');
  await editor.press('Enter');
  await expect(today.getByRole('alert')).toHaveText('标签不能为空。');
  await editor.fill(' Unity ');
  await editor.press('Enter');
  await expect(today.getByRole('alert')).toHaveText('已有同名标签。');
  await editor.press('Escape');
  await expect(physics).toBeFocused();

  await physics.press('Enter');
  await editor.fill('  2D 碰撞  ');
  await editor.press('Enter');
  await expect(today.getByRole('button', { name: '编辑标签「2D 碰撞」' })).toBeFocused();
  await expect(today.getByRole('list', { name: '标签' }).getByRole('listitem')).toHaveText(['Unity×', '2D 碰撞×', 'Input System×']);

  await page.goto('/#history/' + date);
  const history = page.getByRole('region', { name: '编辑标签', exact: true });
  const old = history.getByRole('button', { name: '编辑标签「历史标签」' });
  const historyEditor = history.getByRole('textbox', { name: '编辑标签「历史标签」' });
  await old.dblclick();
  await historyEditor.fill('点外部会取消');
  await history.getByRole('textbox', { name: '标签', exact: true }).click();
  await expect(old).toBeVisible();
  await old.dblclick();
  await historyEditor.fill('项目复习');
  await historyEditor.press('Enter');
  await page.reload();
  await expect(history.getByRole('button', { name: '编辑标签「项目复习」' })).toBeVisible();
  await expect(page.getByText('历史日志正文。', { exact: true })).toBeVisible();
  await page.goto('/#today');
  await expect(today.getByRole('button', { name: '编辑标签「2D 碰撞」' })).toBeVisible();
});

test('词条列表与网络目录高亮悬停标题，智能体图标显示悬停及键盘描边', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const route of ['knowledge', 'network']) {
    await page.goto('/?workspace=knowledge-demo#' + route);
    const directory = page.locator('.knowledge-directory:visible');
    await expect(directory.locator('summary').first()).toBeVisible();
    const title = directory.locator('button strong:visible').first();
    if (await title.count() === 0) await directory.locator('summary').first().click();
    const color = await title.evaluate((element) => getComputedStyle(element).color);
    await title.hover();
    await expect(title).toHaveCSS('color', 'rgb(59, 130, 246)');
    await page.mouse.move(0, 0);
    await expect(title).toHaveCSS('color', color);
  }
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  const drawer = page.getByRole('dialog', { name: '学习智能体' });
  const options = drawer.getByRole('button', { name: '窗口选项' });
  const minimize = drawer.getByRole('button', { name: '最小化学习智能体' });
  const close = drawer.getByRole('button', { name: '关闭学习智能体' });
  for (const button of [options, minimize, close, drawer.getByRole('button', { name: '引用代码', exact: true })]) {
    await button.hover();
    await expect(button).toHaveCSS('outline-color', 'rgb(59, 130, 246)');
    await expect(button).toHaveCSS('outline-style', 'solid');
  }
  await page.mouse.move(0, 0);
  await options.focus();
  await page.keyboard.press('Tab');
  await expect(minimize).toBeFocused();
  await expect(minimize).toHaveCSS('outline-style', 'solid');
  await expect(close).toHaveCSS('outline-style', 'none');
});

test('紧凑下拉随选项适当加宽，长名称在窄屏内换行', async ({ page }, testInfo) => {
  await page.goto('/?workspace=knowledge-demo#path');
  const themedPicker = await page.evaluate(() => CSS.supports('appearance', 'base-select')
    && CSS.supports('width', 'anchor-size(width)') && CSS.supports('selector(select::picker(select))'));
  test.skip(!themedPicker, '此浏览器使用原生选择列表。');
  const board = page.getByRole('region', { name: '实践记录', exact: true });
  const groups = board.getByRole('combobox', { name: '卡组', exact: true });
  const domains = board.getByRole('combobox', { name: '按领域筛选', exact: true });
  for (const [theme, width, height, surface] of [
    ['dark', 1440, 900, 'rgb(30, 41, 59)'],
    ['light', 320, 680, 'rgb(255, 255, 255)'],
  ] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height });
    if (width === 320) await groups.evaluate((element) => {
      element.append(new Option('检查预制体资源引用与场景实例覆盖并交叉验证动画控制器工作流', 'long-name'));
    });
    for (const control of [groups, domains]) {
      await control.click();
      await expect.poll(() => control.evaluate((element) => element.matches(':open'))).toBe(true);
      const picker = await control.evaluate((element: HTMLSelectElement) => {
        const style = getComputedStyle(element, '::picker(select)');
        const rows = Array.from(element.options, (option) => {
          const text = document.createRange();
          text.selectNodeContents(option);
          const { left, right } = option.getBoundingClientRect();
          return { left, right, lines: text.getClientRects().length };
        });
        return { background: style.backgroundColor, radius: style.borderRadius, scrollbar: style.scrollbarWidth,
          menuWidth: parseFloat(style.width), controlWidth: element.getBoundingClientRect().width, rows };
      });
      expect(picker).toMatchObject({ background: surface, radius: '8px', scrollbar: 'thin' });
      expect(picker.menuWidth).toBeGreaterThan(picker.controlWidth);
      expect(picker.rows.every(({ left, right }) => left >= 0 && right <= width)).toBe(true);
      expect(picker.rows.slice(0, 2).map(({ lines }) => lines)).toEqual([1, 1]);
      if (control === groups) {
        if (width === 320) expect(picker.rows.at(-1)!.lines).toBeGreaterThan(1);
        await page.screenshot({ path: testInfo.outputPath(`growth-picker-${theme}.png`) });
      }
      await control.press('Escape');
      await expect.poll(() => control.evaluate((element) => element.matches(':open'))).toBe(false);
    }
  }
});

test('词条分类支持浏览和关键词筛选，确认后才更改当前分类', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 680 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/?workspace=knowledge-demo#knowledge');
  const catalog = page.getByRole('complementary', { name: '词条目录', exact: true });
  const name = catalog.getByRole('searchbox', { name: '搜索名称或别名' });
  await expect(name).toHaveAttribute('autocomplete', 'off');
  const filter = catalog.getByRole('combobox', { name: '词条分类', exact: true });
  const options = catalog.getByRole('listbox', { name: '词条分类', exact: true });
  await expect(filter).toHaveValue('全部分类');
  await filter.click();
  await expect(options.getByRole('option', { name: '2D 渲染', exact: true })).toBeVisible();
  await filter.fill('调试 性能');
  await expect(options.getByRole('option')).toHaveCount(1);
  await expect(catalog.getByRole('heading', { name: '词条列表（96）' })).toBeVisible();
  await filter.press('ArrowDown');
  await filter.press('Enter');
  await expect(filter).toHaveValue('调试与性能');
  await expect(catalog.getByRole('heading', { name: '词条列表（12）' })).toBeVisible();
  await filter.fill('不存在的分类');
  await expect(options.getByRole('status')).toBeVisible();
  await filter.press('Escape');
  await expect(filter).toHaveValue('调试与性能');
  await filter.click();
  await options.getByRole('option', { name: '全部分类', exact: true }).click();
  await expect(catalog.getByRole('heading', { name: '词条列表（96）' })).toBeVisible();
});

test('检索类型按钮悬停和键盘聚焦只描边', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#knowledge');
  await page.getByRole('button', { name: '检索资料', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '检索资料' });
  const search = dialog.getByRole('searchbox', { name: '检索关键词' });
  const all = dialog.getByRole('button', { name: '全部', exact: true });
  const logs = dialog.getByRole('button', { name: '学习日志', exact: true });
  await expect(search).toHaveAttribute('autocomplete', 'off');
  const appearance = await logs.evaluate((button) => {
    const style = getComputedStyle(button);
    return { background: style.backgroundColor, color: style.color };
  });
  const expectOutline = async () => {
    await expect(logs).toHaveCSS('outline-color', 'rgb(59, 130, 246)');
    await expect(logs).toHaveCSS('outline-style', 'solid');
    await expect(logs).toHaveCSS('box-shadow', 'none');
    await expect(logs).toHaveCSS('background-color', appearance.background);
    await expect(logs).toHaveCSS('color', appearance.color);
  };
  await logs.hover();
  await expectOutline();
  await expect(logs).toHaveAttribute('aria-pressed', 'false');
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(0, 0);
  await expect(logs).toHaveCSS('outline-style', 'none');
  await search.press('Tab');
  await expect(all).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(logs).toBeFocused();
  await expectOutline();
  await logs.press('Enter');
  await expect(logs).toHaveAttribute('aria-pressed', 'true');
  await expect(all).toHaveAttribute('aria-pressed', 'false');
});

test('原位辅助按钮聚焦时填色，详情操作按钮与关系链接等高', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const demo = '/?workspace=knowledge-demo#';
  await page.goto(demo + 'today');
  const today = page.getByRole('region', { name: '今日学习', exact: true });
  const importLog = today.getByRole('button', { name: '导入图文学习记录', exact: true });
  const task = today.getByRole('region', { name: '关联任务' }).getByRole('button', { name: '选择任务', exact: true });
  for (const button of [importLog, task]) {
    await button.hover();
    await expect(button).toHaveCSS('background-color', 'rgb(23, 37, 84)');
    await expect(button).toHaveCSS('outline-style', 'none');
    await page.mouse.move(0, 0);
    await button.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await expect(button).toHaveCSS('background-color', 'rgb(23, 37, 84)');
    await expect(button).toHaveCSS('box-shadow', 'none');
    await expect(button).toHaveCSS('outline-style', 'none');
  }

  for (const [route, count] of [['today', 2], ['history/2026-10-01', 2], ['knowledge/demo-entry-0-0', 3], ['code/demo-code-1-1', 2]] as const) {
    await page.goto(demo + route);
    const actions = page.locator(':is(.history-note-actions, .detail-actions):visible > :is(.note-button, .relation-entry-link)');
    await expect(actions).toHaveCount(count);
    const sizes = await actions.evaluateAll((elements) => elements.map((element) => {
      const { height, top } = element.getBoundingClientRect();
      return { height, top };
    }));
    expect(sizes.every(({ height, top }) => height === sizes[0].height && top === sizes[0].top)).toBe(true);
  }
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
