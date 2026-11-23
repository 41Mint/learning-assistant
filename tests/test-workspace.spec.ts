import { expect, test } from '@playwright/test';
import type { GrowthSuggestionRequest } from '../src/types/growthSuggestions';

test('较长的卡面标题和说明截断，跨行卡片等高且详情保留全文', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?workspace=knowledge-demo#path/try');
  const board = page.getByRole('region', { name: '想尝试', exact: true });
  const card = board.getByRole('article', { name: '让角色在待机和移动动作间切换' });
  await card.getByRole('button', { name: '卡片操作' }).click();
  await card.getByRole('button', { name: '编辑卡片' }).click();

  const title = '记录角色在不同输入和不同场景下的移动与待机动作'.repeat(3);
  const description = '运行场景，分别记录三种输入下的动画状态，并比较预制体实例中的差异。'.repeat(8);
  const form = page.getByRole('form', { name: '练习卡片表单' });
  await form.getByLabel('卡片名称').fill(title);
  await form.getByLabel('卡片说明（可选）').fill(description);
  await form.getByRole('button', { name: '保存卡片' }).click();
  await expect(board.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(board.getByText(description, { exact: true })).toBeVisible();
  await board.getByRole('link', { name: '返回卡片' }).click();

  const grid = board.locator('.growth-card-grid');
  const longCard = grid.getByRole('article', { name: title, exact: true });
  const link = longCard.getByRole('link', { name: title, exact: true });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(link).toHaveAttribute('title', title);
    expect(await link.evaluate((element) => element.scrollWidth > element.clientWidth &&
      getComputedStyle(element).textOverflow === 'ellipsis')).toBe(true);
    const synopsis = longCard.locator('.growth-card-summary');
    expect(await synopsis.evaluate((element) => element.scrollHeight > element.clientHeight &&
      getComputedStyle(element).webkitLineClamp === '2')).toBe(true);
    const heights = await grid.locator('.growth-card-slot > :is(article, .growth-group-stack)')
      .evaluateAll((cards) => cards.map((item) => item.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(4);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  }
});

test('组内筛选和建卡从同一弹窗操作，详情返回保留卡组范围', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?workspace=knowledge-demo#path/try?group=demo-prefab-group');
  const group = page.getByRole('dialog', { name: '预制体与场景复用', exact: true });
  const tools = group.getByText('组内操作', { exact: true });
  const filter = group.getByLabel('按领域筛选');
  const back = page.getByRole('link', { name: '返回预制体与场景复用' });
  const exerciseName = '检查自定义预制体参数';
  const outcomeName = '记录预制体参数验证';

  await tools.click();
  await filter.selectOption({ label: 'Unity' });
  await group.getByRole('button', { name: '添加练习', exact: true }).click();
  await group.getByRole('button', { name: '自己填写', exact: true }).click();
  const exercise = page.getByRole('form', { name: '练习卡片表单' });
  await exercise.getByLabel('卡片名称').fill(exerciseName);
  await exercise.getByRole('checkbox', { name: 'Unity', exact: true }).uncheck();
  await exercise.getByRole('checkbox', { name: 'C#', exact: true }).check();
  await exercise.getByRole('button', { name: '保存卡片' }).click();
  await back.click();
  await expect(page).toHaveURL(/#path\/try\?group=demo-prefab-group$/);
  await expect(group.getByRole('article', { name: exerciseName })).toHaveCount(0);
  await tools.click();
  await expect(filter).toHaveValue('Unity');
  await filter.selectOption({ label: 'C#' });
  await expect(group.getByRole('article', { name: exerciseName })).toBeVisible();
  await expect(group.getByRole('heading', { name: '想尝试', exact: true })).toHaveCount(0);
  await group.getByRole('button', { name: '记录自定义成果', exact: true }).click();
  const practice = page.getByRole('form', { name: '实践记录表单' });
  await expect(practice.getByRole('checkbox', { name: 'C#', exact: true })).toBeChecked();
  await practice.getByLabel('成果名称').fill(outcomeName);
  await practice.getByRole('button', { name: '保存实践', exact: true }).click();
  await back.click();
  await expect(page).toHaveURL(/#path\/try\?group=demo-prefab-group$/);
  await expect(group.getByRole('heading', { name: '想尝试', exact: true })).toBeVisible();
  await expect(group.getByRole('heading', { name: '实践记录', exact: true })).toBeVisible();
  await expect(group.getByRole('article', { name: outcomeName })).toBeVisible();
  expect(await group.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('卡组内添加练习向右展开，智能体推荐可归入当前卡组', async ({ page }) => {
  const requests: GrowthSuggestionRequest[] = [];
  const idea = '对比两个实例的预制体覆盖';
  const completed = '验证跨场景预制体同步';
  await page.route('**/api/growth-suggestions', (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { suggestions: [
      { title: idea, action: '对比两个实例的覆盖值。', done: '列出一个共同点和一个区别。', sources: [1] },
      { title: completed, action: '在两处场景对比预制体更新。', done: '核对改动是否同步。', sources: [1] },
    ] } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/?workspace=knowledge-demo#path/try?group=demo-prefab-group');
  const group = page.getByRole('dialog', { name: '预制体与场景复用', exact: true });
  await group.getByText('组内操作', { exact: true }).click();
  await group.getByLabel('按领域筛选').selectOption('Unity');
  const trigger = group.getByRole('button', { name: '添加练习', exact: true });
  const options = group.getByRole('group', { name: '添加练习方式' });
  const recommend = options.getByRole('button', { name: '让智能体推荐' });

  await trigger.hover();
  await expect(options).toBeVisible();
  await expect(options).toHaveCSS('box-shadow', 'none');
  const triggerBox = (await trigger.boundingBox())!;
  const optionsBox = (await options.boundingBox())!;
  expect(optionsBox.x).toBeGreaterThan(triggerBox.x);
  expect(optionsBox.y).toBeCloseTo(triggerBox.y, 1);
  expect(optionsBox.height).toBeCloseTo(triggerBox.height, 1);
  await recommend.hover();
  await expect(options).toBeVisible();
  await group.getByRole('button', { name: '管理卡组' }).hover();
  await expect(options).toBeHidden();
  await trigger.press('Enter');
  await expect(options.getByRole('button', { name: '自己填写' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(options).toBeHidden();
  await expect(group).toBeVisible();

  await trigger.hover();
  await recommend.click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  const suggestions = assistant.getByRole('region', { name: '练习推荐' });
  await expect(suggestions.getByText('推荐给「预制体与场景复用」')).toBeVisible();
  await expect(suggestions.getByLabel('练习领域')).toHaveValue('Unity');
  expect(requests).toHaveLength(0);
  await suggestions.getByRole('button', { name: '生成练习建议' }).click();
  const ideaCard = suggestions.getByRole('article', { name: idea });
  await ideaCard.getByRole('button', { name: '卡片操作' }).click();
  await page.getByRole('button', { name: '加入此卡组', exact: true }).click();
  await expect(suggestions.getByRole('status')).toHaveText(`「${idea}」已加入「预制体与场景复用」。`);
  expect(requests[0].focus).toBe('Unity 预制体与场景复用');
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await expect(group.getByRole('article', { name: idea })).toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(group.getByLabel('按领域筛选')).toHaveValue('Unity');
  await trigger.click();
  await recommend.click();
  const completedCard = suggestions.getByRole('article', { name: completed });
  await completedCard.getByRole('button', { name: '卡片操作' }).click();
  await completedCard.getByRole('button', { name: '我做到了' }).click();
  const practice = page.getByRole('form', { name: '实践记录表单' });
  await expect(practice.getByLabel('成果名称')).toHaveValue(completed);
  await practice.getByRole('button', { name: '保存实践', exact: true }).click();
  await page.getByRole('link', { name: '返回预制体与场景复用' }).click();
  await expect(page).toHaveURL(/#path\/try\?group=demo-prefab-group$/);
  await expect(group.getByRole('article', { name: completed })).toBeVisible();
});

test('测试工作区提供关联样例，窄屏重置可以恢复样例任务和回收站', async ({ page }, testInfo) => {
  const workspace = '/?workspace=knowledge-demo';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(workspace + '#today');
  const today = page.getByRole('region', { name: '今日学习', exact: true });
  const taskName = '验证预制体更新会影响哪些实例';
  await expect(today.getByText(taskName, { exact: true })).toBeVisible();
  await expect(today.getByText('检查预制体实例', { exact: true })).toBeVisible();

  await page.goto(workspace + '#path');
  const board = page.getByRole('region', { name: '实践记录', exact: true });
  const folder = page.getByRole('dialog', { name: '预制体与场景复用', exact: true });
  const picker = board.getByLabel('打开卡组', { exact: true });
  await expect(picker).toBeEnabled();
  const filterBox = (await board.getByLabel('按领域筛选').boundingBox())!;
  const pickerBox = (await picker.boundingBox())!;
  const createBox = (await board.getByRole('button', { name: '新建卡组', exact: true }).boundingBox())!;
  expect(pickerBox.x).toBeGreaterThan(filterBox.x + filterBox.width);
  expect(createBox.x).toBeGreaterThan(pickerBox.x + pickerBox.width);
  expect(pickerBox.height).toBeCloseTo(createBox.height, 1);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await picker.focus();
    await expect(picker).toHaveCSS('box-shadow', 'none');
    await expect(picker).toHaveCSS('outline-width', '1px');
    if (colorScheme === 'light') await picker.click();
    else await picker.press('Space');
    await expect.poll(() => picker.evaluate((element) => element.matches(':open'))).toBe(true);
    await expect(picker).toHaveCSS('box-shadow', 'none');
    await expect(picker).toHaveCSS('outline-width', '1px');
    await page.keyboard.press('Escape');
  }
  await picker.selectOption({ label: '预制体与场景复用' });
  await expect(folder.getByRole('article')).toHaveCount(2);
  await folder.getByRole('button', { name: '关闭卡组' }).click();
  await expect(page).toHaveURL(/#path$/);
  await expect(picker).toHaveValue('');
  await expect(picker.locator('option:checked')).toHaveText('卡组');
  const views = board.getByRole('navigation', { name: '实践卡片视图' });
  await expect(views.getByRole('link')).toHaveCount(2);
  await board.getByRole('link', { name: /打开卡组 预制体与场景复用/ }).click();
  await expect(folder.getByRole('heading', { name: '想尝试', exact: true })).toBeVisible();
  await expect(folder.getByRole('link', { name: '观察预制体实例的覆盖值' })).toBeVisible();
  const folderLink = folder.getByRole('link', { name: '在两个场景复用拾取物预制体' });
  await folderLink.click();
  const outcome = board.getByRole('article', { name: '在两个场景复用拾取物预制体' });
  await expect(outcome.getByRole('link', { name: '返回预制体与场景复用' })).toBeVisible();
  await page.goBack();
  await expect(folderLink).toBeVisible();
  await page.goForward();
  await outcome.getByRole('link', { name: '返回预制体与场景复用' }).click();
  await expect(folderLink).toBeVisible();
  await folderLink.click();
  await expect(outcome.getByText('2 次实践', { exact: true })).toBeVisible();
  await expect(outcome.getByRole('link', { name: /PickupSpawner\.cs/ })).toHaveCount(2);
  await outcome.getByRole('link', { name: /在两个场景验证预制体引用/ }).first().click();
  await expect(page).toHaveURL(/\?workspace=knowledge-demo#history\/2026-10-05$/);
  const image = page.getByRole('img', { name: '拾取物预制体与两个场景实例示意图' });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((item: HTMLImageElement) => item.naturalWidth)).toBe(640);

  await page.getByRole('link', { name: '参考路径与任务', exact: true }).click();
  const topics = page.getByRole('navigation', { name: '参考主题' });
  await topics.getByRole('button', { name: '预制体与场景复用', exact: true }).click();
  const topic = page.getByRole('article', { name: '预制体与场景复用', exact: true });
  await topic.getByRole('checkbox', { name: '完成任务：' + taskName }).click();
  await expect(topic.getByText('2/2 已完成')).toBeVisible();

  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const trash = page.getByRole('region', { name: '回收站', exact: true });
  await expect(trash.getByText(/拾取物原型草稿/)).toBeVisible();
  await trash.getByRole('link', { name: '词条', exact: true }).click();
  await expect(trash.getByText('早期生成器参数', { exact: true })).toBeVisible();
  await trash.getByRole('button', { name: '恢复词条', exact: true }).click();
  await page.getByRole('dialog', { name: '恢复词条', exact: true }).getByRole('button', { name: '确认恢复' }).click();
  await expect(trash.getByRole('status')).toContainText('已恢复词条');
  await trash.getByRole('link', { name: '代码', exact: true }).click();
  await expect(trash.getByText('Assets/Scripts/PickupSpawner.cs', { exact: true })).toBeVisible();

  const launcher = page.getByRole('button', { name: '开发者工具', exact: true });
  const panel = page.getByRole('region', { name: '开发者工具', exact: true });
  await launcher.click();
  await page.screenshot({ path: testInfo.outputPath('dev-tools-dark.png') });
  const title = await panel.getByRole('heading', { name: '开发者工具', exact: true }).boundingBox();
  const initial = await panel.boundingBox();
  await page.mouse.move(title!.x + 12, title!.y + 8);
  await page.mouse.down();
  await page.mouse.move(40, 60, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.x).toBeLessThan(initial!.x);

  await page.setViewportSize({ width: 320, height: 600 });
  await page.emulateMedia({ colorScheme: 'light' });
  const narrow = (await panel.boundingBox())!;
  expect(narrow.x).toBeGreaterThanOrEqual(0);
  expect(narrow.x + narrow.width).toBeLessThanOrEqual(320);
  expect(narrow.y + narrow.height).toBeLessThanOrEqual(600);
  await page.screenshot({ path: testInfo.outputPath('dev-tools-narrow.png') });
  await panel.getByRole('button', { name: '恢复示例数据', exact: true }).click();
  const reset = page.getByRole('dialog', { name: '恢复示例数据', exact: true });
  await reset.getByRole('button', { name: '取消', exact: true }).click();
  await panel.getByRole('button', { name: '关闭开发者工具', exact: true }).click();
  await trash.getByRole('link', { name: '词条', exact: true }).click();
  await expect(trash.getByText('暂无已删除的词条。')).toBeVisible();
  await launcher.click();
  await panel.getByRole('button', { name: '恢复示例数据', exact: true }).click();
  await Promise.all([page.waitForEvent('load'), reset.getByRole('button', { name: '确认恢复' }).click()]);
  await expect(trash.getByText('早期生成器参数', { exact: true })).toBeVisible();
  await page.goto(workspace + '#today');
  await expect(today.getByText(taskName, { exact: true })).toBeVisible();
});
