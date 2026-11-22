import { expect, test } from '@playwright/test';

test('日志从工具栏或右键原位引用词条，保留选区且不创建知识关联', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#today');
  const id = await page.evaluate(async () => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const store = useKnowledgeStore.getState();
    store.loadKnowledge();
    return store.saveEntry({ title: 'PPU', aliases: ['Pixels Per Unit'], category: '2D 素材', content: '像素与**世界单位**的换算。' });
  });
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const body = page.getByLabel('学习内容（Markdown）', { exact: true });
  const text = '回顾 Pixels Per Unit 的设置。';
  await body.fill(text);
  await body.evaluate((field: HTMLTextAreaElement) => field.setSelectionRange(3, 18, 'backward'));
  const trigger = page.getByRole('button', { name: '插入', exact: true });
  const panel = page.getByRole('group', { name: '插入到 Markdown' });
  const type = panel.getByRole('button', { name: '引用词条', exact: true });
  const search = panel.getByRole('combobox', { name: '引用词条', exact: true });
  await trigger.press('Enter');
  await expect(type).toBeFocused();
  await type.press('Enter');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('Pixels Per Unit');
  await expect(panel.getByRole('option', { name: 'PPU' })).toBeVisible();
  await search.press('Escape');
  await expect(panel).toBeHidden();
  await expect(body).toBeFocused();
  expect(await body.evaluate((field: HTMLTextAreaElement) => [field.selectionStart, field.selectionEnd, field.selectionDirection]))
    .toEqual([3, 18, 'backward']);

  await body.click({ button: 'right', position: { x: 72, y: 24 } });
  await type.click();
  await expect(search).toHaveValue('Pixels Per Unit');
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
  await search.press('ArrowDown');
  await search.press('Enter');
  await panel.getByRole('button', { name: '插入到正文' }).click();
  await expect(body).toBeFocused();
  const href = '#knowledge/' + id + '?cite=1';
  const next = '回顾 [Pixels Per Unit](<' + href + '>) 的设置。';
  await expect(body).toHaveValue(next);

  await page.getByRole('button', { name: '预览', exact: true }).click();
  const link = page.getByRole('link', { name: 'Pixels Per Unit', exact: true });
  await expect(link).toHaveCSS('text-decoration-style', 'dashed');
  expect(await link.evaluate((node) => getComputedStyle(node).color)).toBe(await link.evaluate((node) => getComputedStyle(node.parentElement!).color));
  await link.focus();
  const preview = page.getByRole('tooltip');
  await expect(preview).toContainText('像素与世界单位的换算。');
  await expect(preview).toContainText('2D 素材');
  await expect(preview).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await link.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(link).toBeFocused();
  await link.click();
  await expect(page).toHaveURL(new RegExp('#knowledge/' + id));
  await expect(page.getByRole('heading', { name: 'PPU', exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: '源码', exact: true }).click();
  await expect(body).toHaveValue(next);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.reload();
  await expect(link).toHaveAttribute('href', href);
  const result = await page.evaluate(async (id) => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const store = useKnowledgeStore.getState();
    const associations = store.logLinks.length + store.relations.length;
    const entry = store.entries.find((item) => item.id === id)!;
    store.saveEntry({ ...entry, title: '像素单位' }, { id });
    return associations;
  }, id);
  expect(result).toBe(0);
  await page.emulateMedia({ colorScheme: 'dark' });
  await link.hover();
  await expect(preview).toContainText('像素单位');
  await expect(preview).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  const previewBounds = (await preview.boundingBox())!;
  expect(previewBounds.x).toBeGreaterThanOrEqual(8);
  expect(previewBounds.x + previewBounds.width).toBeLessThanOrEqual(382);
  await page.evaluate(async (id) => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    useKnowledgeStore.getState().trashEntry(id);
  }, id);
  await expect(link).toHaveCount(0);
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('region', { name: '今日学习', exact: true }).getByText(text, { exact: true })).toBeVisible();
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
  const groups = board.getByRole('combobox', { name: '打开卡组', exact: true });
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

test('Markdown 源码和预览共用编辑区，切换保留各自的滚动位置', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    useStudyLogStore.getState().updateContent('# Day1 学习记录\n\n' + 'PPU 素材设置和学习观察。\n\n'.repeat(40));
  });
  await page.locator('.study-log-card').getByRole('button', { name: '编辑', exact: true }).click();
  const editor = page.locator('#study-log-content');
  const modes = page.getByRole('group', { name: 'Markdown 视图' });
  const preview = page.getByRole('region', { name: '学习内容预览' });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const before = await editor.evaluate((element: HTMLTextAreaElement) => {
        element.setSelectionRange(300, 304);
        element.scrollTop = 150;
        return element.scrollTop;
      });
      const sourceBounds = (await editor.boundingBox())!;
      await modes.getByRole('button', { name: '预览', exact: true }).click();
      await expect(editor).toBeHidden();
      expect(await preview.boundingBox()).toEqual(sourceBounds);
      expect(await preview.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const previewScroll = await preview.evaluate((element) => {
        element.scrollTop = 380;
        return element.scrollTop;
      });
      expect(previewScroll).toBeGreaterThan(0);
      await modes.getByRole('button', { name: '源码', exact: true }).click();
      await expect(preview).toHaveCount(0);
      expect(await editor.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd, element.scrollTop]))
        .toEqual([300, 304, before]);
      await modes.getByRole('button', { name: '预览', exact: true }).click();
      expect(await preview.evaluate((element) => element.scrollTop)).toBe(previewScroll);
      await modes.getByRole('button', { name: '源码', exact: true }).click();
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.markdown-editor').screenshot({ path: testInfo.outputPath('markdown-source-dark.png') });
  await modes.getByRole('button', { name: '预览', exact: true }).click();
  await page.locator('.markdown-editor').screenshot({ path: testInfo.outputPath('markdown-preview-dark.png') });
});

test('Markdown 编辑区支持拖动和键盘调整高度，源码和预览共用新高度', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/#today');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const form = page.getByRole('form', { name: '今日记录编辑表单' });
  const source = form.getByRole('textbox', { name: '学习内容（Markdown）' });
  const preview = form.getByRole('region', { name: '学习内容预览' });
  const resize = form.getByRole('button', { name: '调整编辑区高度' });
  const initial = (await source.boundingBox())!.height;
  await form.getByRole('button', { name: '预览', exact: true }).click();
  await resize.scrollIntoViewIfNeeded();
  const handle = (await resize.boundingBox())!;
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 64, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await preview.boundingBox())!.height).toBeGreaterThan(initial + 60);
  const height = (await preview.boundingBox())!.height;
  await form.getByRole('button', { name: '源码', exact: true }).click();
  expect((await source.boundingBox())!.height).toBe(height);
  await resize.press('ArrowUp');
  expect((await source.boundingBox())!.height).toBeCloseTo(height - 24, 0);
  await resize.press('Enter');
  expect((await source.boundingBox())!.height).toBe(initial);
});

test('Markdown 格式工具操作选区，可撤销并在预览中核对', async ({ page }) => {
  await page.goto('/#today');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const form = page.getByRole('form', { name: '今日记录编辑表单' });
  const body = form.getByRole('textbox', { name: '学习内容（Markdown）' });
  const tools = form.getByRole('group', { name: 'Markdown 格式' });
  await body.fill('比较预制体实例');
  await body.evaluate((field: HTMLTextAreaElement) => field.setSelectionRange(2, 5));
  await tools.getByRole('button', { name: '加粗', exact: true }).click();
  await expect(body).toHaveValue('比较**预制体**实例');
  await expect(body).toBeFocused();
  expect(await body.evaluate((field: HTMLTextAreaElement) => field.value.slice(field.selectionStart, field.selectionEnd))).toBe('预制体');
  await body.press('Control+z');
  await expect(body).toHaveValue('比较预制体实例');
  await body.press('Control+Shift+z');
  await expect(body).toHaveValue('比较**预制体**实例');

  await body.fill('前文\n\n检查配置\n运行场景\n\n后文');
  await body.evaluate((field: HTMLTextAreaElement) => field.setSelectionRange(field.value.indexOf('检查'), field.value.indexOf('\n\n后文')));
  await tools.getByRole('button', { name: '有序列表', exact: true }).click();
  await expect(body).toHaveValue('前文\n\n1. 检查配置\n2. 运行场景\n\n后文');
  await tools.getByRole('button', { name: '任务列表', exact: true }).click();
  await expect(body).toHaveValue('前文\n\n- [ ] 检查配置\n- [ ] 运行场景\n\n后文');
  await body.evaluate((field: HTMLTextAreaElement) => {
    const start = field.value.indexOf('后文');
    field.setSelectionRange(start, start + 2);
  });
  const link = tools.getByRole('button', { name: '链接', exact: true });
  await expect(link.locator('svg')).toBeVisible();
  await expect(link).toHaveAttribute('title', '链接');
  await link.click();
  await page.keyboard.insertText('https://example.test/notes');
  await expect(body).toHaveValue(/\[后文\]\(https:\/\/example.test\/notes\)/);
  await form.getByRole('button', { name: '预览', exact: true }).click();
  const preview = form.getByRole('region', { name: '学习内容预览' });
  await expect(preview.getByRole('checkbox')).toHaveCount(2);
  await expect(preview.getByRole('link', { name: '后文' })).toHaveAttribute('href', 'https://example.test/notes');
  await expect(tools.getByRole('button', { name: '加粗', exact: true })).toBeDisabled();
  await form.getByRole('button', { name: '保存记录' }).click();
  await expect(page.getByRole('region', { name: '今日学习', exact: true }).getByRole('link', { name: '后文' })).toBeVisible();
});

test('Markdown 标题在空白处横向展开，鼠标与键盘都能选择级别', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#today');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const form = page.getByRole('form', { name: '今日记录编辑表单' });
  const source = form.getByRole('textbox', { name: '学习内容（Markdown）' });
  const tools = form.getByRole('group', { name: 'Markdown 格式' });
  const modes = form.getByRole('group', { name: 'Markdown 视图' });
  const h2 = tools.getByRole('button', { name: '二级标题', exact: true });
  const levels = tools.getByRole('group', { name: '标题级别', exact: true });
  const h6 = levels.getByRole('button', { name: '六级标题', exact: true });
  await source.fill('### 检查配置\n运行场景');
  await source.evaluate((element: HTMLTextAreaElement) => element.select());
  const sourceBounds = await source.boundingBox();
  const modeBounds = (await modes.boundingBox())!;
  await expect(h2).toHaveAttribute('aria-expanded', 'false');
  await h2.hover();
  await expect(h2).toHaveAttribute('aria-expanded', 'true');
  await expect(levels.getByRole('button')).toHaveCount(5);
  await h6.hover();
  await expect(h2).toHaveAttribute('aria-expanded', 'true');
  const levelBounds = (await levels.boundingBox())!;
  const triggerBounds = (await h2.boundingBox())!;
  expect(levelBounds.x).toBeCloseTo(triggerBounds.x + triggerBounds.width, 0);
  expect(levelBounds.x + levelBounds.width).toBeLessThan(modeBounds.x);
  expect(await modes.boundingBox()).toEqual(modeBounds);
  expect(await source.boundingBox()).toEqual(sourceBounds);
  await source.hover({ position: { x: 15, y: 15 } });
  await expect(h2).toHaveAttribute('aria-expanded', 'false');

  await tools.getByRole('button', { name: '代码块', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(h2).toBeFocused();
  await expect(h2).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(levels.getByRole('button', { name: '一级标题', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(h2).toBeFocused();
  await expect(h2).toHaveAttribute('aria-expanded', 'false');
  await h2.press('Enter');
  await expect(source).toHaveValue('## 检查配置\n## 运行场景');
  await expect(source).toBeFocused();
  await source.press('Control+z');
  await expect(source).toHaveValue('### 检查配置\n运行场景');

  await source.evaluate((element: HTMLTextAreaElement) => element.select());
  await h2.hover();
  await h6.click();
  await expect(source).toHaveValue('###### 检查配置\n###### 运行场景');
  await modes.getByRole('button', { name: '预览', exact: true }).click();
  const preview = form.getByRole('region', { name: '学习内容预览' });
  await expect(preview.getByRole('heading', { level: 6, name: '检查配置' })).toBeVisible();
  await expect(preview.getByRole('heading', { level: 6, name: '运行场景' })).toBeVisible();
  await expect(h2).toBeDisabled();
});

test.describe('触屏 Markdown 标题', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('窄编辑区原位选择全部级别，宽屏触摸可以展开', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/#today');
    await page.getByRole('button', { name: '编辑', exact: true }).tap();
    const form = page.getByRole('form', { name: '今日记录编辑表单' });
    const source = form.getByRole('textbox', { name: '学习内容（Markdown）' });
    const tools = form.getByRole('group', { name: 'Markdown 格式' });
    const picker = tools.getByRole('button', { name: '选择标题级别', exact: true });
    const levels = tools.getByRole('group', { name: '标题级别', exact: true });
    await source.fill('测试标题');
    const closed = await source.boundingBox();
    await picker.tap();
    await expect(levels.getByRole('button', { name: /[一二三四五六]级标题/ })).toHaveCount(6);
    await expect(tools.getByRole('button', { name: '加粗', exact: true })).toHaveCount(0);
    expect(await source.boundingBox()).toEqual(closed);
    await expect(levels.getByRole('button', { name: '二级标题', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(picker).toBeFocused();
    await expect(levels).toHaveCount(0);
    await picker.tap();
    await levels.getByRole('button', { name: '四级标题', exact: true }).tap();
    await expect(source).toHaveValue('#### 测试标题');
    await expect(source).toBeFocused();
    await expect(levels).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.setViewportSize({ width: 1320, height: 900 });
    const h2 = tools.getByRole('button', { name: '二级标题', exact: true });
    await h2.tap();
    await expect(source).toHaveValue('#### 测试标题');
    await expect(h2).toHaveAttribute('aria-expanded', 'true');
    await levels.getByRole('button', { name: '五级标题', exact: true }).tap();
    await expect(source).toHaveValue('##### 测试标题');
  });
});

test('连在一起的文字入口平滑移动选中底色，键盘焦点用下划线', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?workspace=knowledge-demo#path');
  await page.addStyleTag({ content: '@media (prefers-reduced-motion: no-preference) { .workspace-segments { --app-motion-duration: 800ms; } }' });
  const views = page.getByRole('navigation', { name: '实践卡片视图' });
  const indicator = views.locator('.workspace-segment-indicator');
  const ideas = views.getByRole('link', { name: '想尝试', exact: true });
  await ideas.hover();
  await expect(ideas).toHaveCSS('outline-style', 'none');
  await views.getByRole('link', { name: '实践记录', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(ideas).toBeFocused();
  await expect(ideas).toHaveCSS('text-decoration-line', 'underline');
  await expect(ideas).toHaveCSS('outline-style', 'none');
  await expect(ideas).toHaveCSS('box-shadow', 'none');
  await ideas.press('Enter');
  await expect(ideas).toHaveAttribute('aria-current', 'page');
  await expect.poll(() => indicator.evaluate((marker) => marker.getAnimations().some(
    (animation) => animation instanceof CSSTransition && animation.transitionProperty === 'transform',
  ))).toBe(true);
  await page.goBack();
  await expect(views.getByRole('link', { name: '实践记录', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(indicator).toHaveCSS('transition-duration', '0s, 0s, 0s');
  await page.goto('/?workspace=knowledge-demo#data');
  const trash = page.getByRole('navigation', { name: '回收站分类' });
  const entries = trash.getByRole('link', { name: '词条', exact: true });
  await entries.click();
  await expect(entries).toHaveAttribute('aria-current', 'page');
  await expect(trash.locator('.workspace-segment-indicator')).toBeVisible();
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
