import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { GrowthSuggestionRequest } from '../src/types/growthSuggestions';
import type { ChatRequest } from '../src/types/assistantChat';

const title = '让角色左右移动并停下来';
const oldDate = '2026-10-02';

async function seedLearning(page: Page) {
  await page.addInitScript(({ date }) => {
    if (localStorage.getItem('growth-test-seeded')) return;
    localStorage.setItem('growth-test-seeded', '1');
    localStorage.setItem('learning-assistant:study-logs', JSON.stringify([
      { id: 'log-one', date, content: '# 角色移动笔记', tags: [], knowledgePoints: [], duration: 25, createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('learning-assistant:knowledge', JSON.stringify({
      version: 1,
      entries: [{ id: 'entry-one', title: '输入处理', aliases: [], category: '', content: '', createdAt: 1, updatedAt: 1 }],
      logLinks: [],
      relations: [],
    }));
    localStorage.setItem('learning-assistant:skill-tree', JSON.stringify({ version: 1, completedIds: ['algorithm-foundations'] }));
    localStorage.setItem('learning-assistant:tasks', JSON.stringify([
      { id: 'task-one', parentSkillId: 'unity-foundations', title: '旧任务', description: '', completed: false, createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('learning-assistant:current-goal', JSON.stringify({
      version: 2, goal: { id: 'task-one', type: 'task', label: '旧任务' },
    }));
  }, { date: oldDate });
}

async function recordPreset(page: Page) {
  await page.getByRole('link', { name: '待尝试', exact: true }).click();
  const card = page.getByRole('article', { name: title, exact: true });
  await card.click({ button: 'right' });
  await card.getByRole('button', { name: '我做到了' }).click();
  const form = page.getByRole('form', { name: '实践记录表单' });
  await form.getByLabel('实践日期').fill(oldDate);
  await form.getByLabel('这次做了什么（可选）').fill('跟教程实现移动');
  await form.getByText('关联学习日志（0）', { exact: true }).click();
  await form.getByRole('checkbox', { name: /角色移动笔记/ }).check();
  await form.getByText('关联知识词条（0）', { exact: true }).click();
  await form.getByRole('checkbox', { name: '输入处理', exact: true }).check();
  await form.getByRole('button', { name: '保存实践' }).click();
}

test('跨领域成果可事后补记、多次实践，并回到原日志和词条', async ({ page }) => {
  await seedLearning(page);
  await page.goto('/#path');
  await recordPreset(page);
  const recent = page.getByRole('region', { name: '已完成' });
  const outcome = recent.getByRole('article', { name: title, exact: true });
  await recent.getByRole('link', { name: '返回卡片' }).click();
  await outcome.getByRole('button', { name: '卡片操作' }).click();
  await outcome.getByRole('button', { name: '追加实践' }).click();
  const form = page.getByRole('form', { name: '实践记录表单' });
  await form.getByLabel('这次做了什么（可选）').fill('换个场景重新实现');
  await form.getByRole('button', { name: '保存实践' }).click();
  await page.reload();
  for (const domain of ['C#', 'Unity']) {
    await page.getByLabel('按领域筛选').selectOption(domain);
    await expect(outcome).toContainText('2 次实践');
  }
  await outcome.getByRole('link', { name: title, exact: true }).click();
  await expect(outcome.locator('time').last()).toHaveText(oldDate);
  await outcome.getByRole('link', { name: /角色移动笔记/ }).click();
  await expect(page).toHaveURL(new RegExp('#history/' + oldDate + '$'));
  await expect(page.getByLabel('定位学习日期')).toHaveValue(oldDate);
  await page.goBack();
  await outcome.getByRole('link', { name: '输入处理' }).click();
  await expect(page.getByRole('heading', { name: '输入处理', exact: true })).toBeVisible();
  await page.goBack();
  await outcome.getByRole('button', { name: '编辑实践' }).first().click();
  await form.getByLabel('这次做了什么（可选）').fill('换场景并修改移动速度');
  await form.getByRole('button', { name: '保存实践' }).click();
  await expect(outcome).toContainText('换场景并修改移动速度');
  await recent.getByRole('link', { name: '返回卡片' }).click();
  await outcome.getByRole('button', { name: '卡片操作' }).click();
  await outcome.getByRole('button', { name: '编辑实践' }).click();
  const chooser = page.getByRole('dialog', { name: '选择要编辑的实践' });
  await chooser.getByLabel('实践记录').selectOption({ label: oldDate + ' · 跟教程实现移动' });
  await chooser.getByRole('button', { name: '继续编辑' }).click();
  await expect(form.getByLabel('这次做了什么（可选）')).toHaveValue('跟教程实现移动');
  await form.getByRole('button', { name: '取消', exact: true }).click();
  await outcome.getByRole('button', { name: '卡片操作' }).click();
  await outcome.getByRole('button', { name: '删除实践' }).click();
  const confirm = page.getByRole('dialog', { name: '删除实践' });
  await expect(confirm.getByLabel('实践记录').locator('option:checked')).toContainText('换场景并修改移动速度');
  await confirm.getByRole('button', { name: '确认删除' }).click();
  await expect(recent.getByText('已删除实践。')).toBeVisible();
  await expect(outcome).toContainText('1 次实践');
  await expect(recent.getByText('已删除实践。')).toBeHidden();
  await outcome.getByRole('link', { name: title, exact: true }).click();
  await expect(outcome.getByRole('link', { name: /角色移动笔记/ })).toBeVisible();

  await recent.getByRole('button', { name: '记录自定义成果' }).click();
  await form.getByLabel('成果名称').fill('让拾取计数出现在屏幕上');
  await form.getByLabel('卡片说明（可选）').fill('用文本组件显示玩家本次的拾取数量。');
  await form.getByRole('checkbox', { name: 'C#', exact: true }).check();
  await form.getByRole('button', { name: '保存实践' }).click();
  await expect(recent.getByRole('article', { name: '让拾取计数出现在屏幕上' })).toBeVisible();
  await recent.getByRole('link', { name: '返回卡片' }).click();
  await expect(recent.getByRole('article', { name: '让拾取计数出现在屏幕上' })).toContainText('用文本组件显示玩家本次的拾取数量。');
});

test('待尝试支持创建、编辑、详情和恢复移出的内置练习', async ({ page }) => {
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '待尝试' });
  const form = page.getByRole('form', { name: '待尝试卡片表单' });
  await board.getByRole('button', { name: '添加待尝试' }).click();
  await board.getByRole('button', { name: '自己填写' }).click();
  await form.getByLabel('卡片名称').fill('做一个暂停菜单');
  await form.getByLabel('卡片说明（可选）').fill('学习如何切换暂停状态。');
  await form.getByLabel('完成条件（可选）').fill('恢复时角色可继续移动。');
  await form.getByRole('button', { name: '保存卡片' }).click();
  await page.reload();
  const own = board.getByRole('article', { name: '做一个暂停菜单', exact: true });
  await expect(own).toContainText('恢复时角色可继续移动。');
  await own.getByRole('button', { name: '编辑卡片' }).click();
  await form.getByLabel('卡片说明（可选）').fill('按 Esc 切换暂停状态。');
  await form.getByRole('button', { name: '保存卡片' }).click();
  await expect(own).toContainText('按 Esc 切换暂停状态。');
  await own.getByRole('link', { name: '返回卡片' }).click();
  const preset = board.getByRole('article', { name: title, exact: true });
  await preset.getByRole('button', { name: '卡片操作' }).click();
  await preset.getByRole('button', { name: '编辑卡片' }).click();
  await form.getByLabel('卡片说明（可选）').fill('测试松开方向键后能否立刻停止。');
  await form.getByRole('button', { name: '保存卡片' }).click();
  await preset.getByRole('link', { name: '返回卡片' }).click();
  await expect(preset).toContainText('测试松开方向键后能否立刻停止。');
  await preset.getByRole('button', { name: '卡片操作' }).click();
  await preset.getByRole('button', { name: '移出待尝试' }).click();
  await page.getByRole('dialog', { name: '移出待尝试' }).getByRole('button', { name: '确认移出' }).click();
  await page.reload();
  await expect(preset).toHaveCount(0);
  await board.getByRole('button', { name: '恢复内置练习' }).click();
  await page.getByRole('dialog', { name: '恢复内置练习' }).getByRole('button', { name: '恢复', exact: true }).click();
  await expect(preset).toContainText('测试松开方向键后能否立刻停止。');
  await own.getByRole('button', { name: '卡片操作' }).click();
  await own.getByRole('button', { name: '移出待尝试' }).click();
  await page.getByRole('dialog', { name: '移出待尝试' }).getByRole('button', { name: '确认移出' }).click();
  await expect(own).toHaveCount(0);
});

test('旧节点和任务保留，参考基础不锁住后续节点，目标可直接清除', async ({ page }) => {
  await seedLearning(page);
  await page.goto('/');
  await page.getByRole('button', { name: '清除当前目标' }).click();
  await expect(page.getByText('可以直接开始学习', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('可以直接开始学习', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '成长记录', exact: true }).click();
  await page.getByRole('link', { name: '参考路径与任务', exact: true }).click();
  const unity = page.getByRole('article', { name: 'Unity 核心工作流', exact: true });
  const algorithm = page.getByRole('article', { name: '算法基础保持', exact: true });
  const topics = page.getByRole('navigation', { name: '参考主题' });
  await topics.getByRole('button', { name: /算法基础保持/ }).click();
  await expect(algorithm.getByText('已标记完成', { exact: true })).toBeVisible();
  await topics.getByRole('button', { name: 'Unity 核心工作流', exact: true }).click();
  await expect(algorithm).toBeHidden();
  await expect(unity.getByText('旧任务', { exact: true })).toBeVisible();
  await expect(unity.getByText('可参考 C# 与面向对象基础')).toBeVisible();
  await unity.getByRole('button', { name: '标记完成', exact: true }).click();
  await expect(unity.getByRole('button', { name: '撤销完成' })).toBeVisible();
  await unity.getByRole('button', { name: '添加任务', exact: true }).click();
  await unity.getByPlaceholder('添加一个可执行任务').fill('改一下角色移动速度');
  await unity.getByRole('button', { name: '保存任务', exact: true }).click();
  await expect(unity.getByText('改一下角色移动速度', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '已完成' }).getByRole('article')).toHaveCount(0);
});

test('完整备份在独立浏览器恢复实践与回链，v3 继续恢复词条和任务', async ({ page, browser }) => {
  await seedLearning(page);
  await page.goto('/#path');
  await recordPreset(page);
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(backup.version).toBe(8);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    const input = restored.getByLabel('选择备份文件', { exact: true });
    async function restore(value: unknown) {
      await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
      await Promise.all([
        restored.waitForEvent('load'),
        restored.getByRole('button', { name: '确认恢复并刷新' }).click(),
      ]);
    }

    await restore(backup);
    await restored.getByRole('link', { name: '成长记录', exact: true }).click();
    const recent = restored.getByRole('region', { name: '已完成' });
    await expect(recent.getByRole('article', { name: title })).toContainText('跟教程实现移动');
    await recent.getByRole('link', { name: title, exact: true }).click();
    await expect(recent.getByRole('link', { name: '输入处理' })).toHaveAttribute('href', '#knowledge/entry-one');
    await expect(recent.getByRole('link', { name: /角色移动笔记/ })).toHaveAttribute('href', `#history/${oldDate}`);
    await restored.getByRole('link', { name: '数据管理', exact: true }).click();

    const invalid = structuredClone(backup);
    invalid.data.growth.outcomes[0].practices[0].date = '2026-02-31';
    await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
    await expect(restored.getByText('成长记录格式不正确，无法读取。', { exact: true })).toBeVisible();
    await expect(restored.getByRole('button', { name: '确认恢复并刷新' })).toHaveCount(0);

    await restore({ ...backup, version: 3, data: { ...backup.data, growth: undefined } });
    await restored.getByRole('link', { name: '成长记录', exact: true }).click();
    await expect(recent.getByRole('article')).toHaveCount(0);
    await restored.getByRole('link', { name: '参考路径与任务', exact: true }).click();
    await restored.getByRole('navigation', { name: '参考主题' }).getByRole('button', { name: 'Unity 核心工作流', exact: true }).click();
    await expect(restored.getByRole('article', { name: 'Unity 核心工作流' }).getByText('旧任务', { exact: true })).toBeVisible();
    await restored.getByRole('link', { name: '知识词条', exact: true }).click();
    await expect(restored.getByRole('button', { name: /输入处理/ })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('窄屏成长视图独立切换，智能推荐换一批并预填实际引用', async ({ page }, testInfo) => {
  await seedLearning(page);
  const requests: GrowthSuggestionRequest[] = [];
  await page.route('**/api/growth-suggestions', async (route) => {
    const input: GrowthSuggestionRequest = route.request().postDataJSON();
    requests.push(input);
    const log = input.sources.findIndex((source) => source.kind === 'log') + 1;
    const entry = input.sources.findIndex((source) => source.kind === 'entry') + 1;
    await route.fulfill({ json: { suggestions: [
      { title: '记录方向键的状态', action: '记录按下和松开的状态变化。', done: '松开后状态变为 false。', sources: [log] },
      ...(requests.length > 1 ? [{ title: '为输入增加边界检查', action: '添加一次边界检查。', done: '输入超出范围时返回失败。', sources: [log, entry] }] : []),
      { title: '无依据的推荐', action: '尝试一件事。', done: '看到结果。', sources: [99] },
    ] } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#path');
  await page.getByRole('link', { name: '待尝试', exact: true }).click();
  await expect(page.getByRole('region', { name: '已完成' })).toBeHidden();
  await expect(page.getByRole('region', { name: '参考路径与任务' })).toBeHidden();
  const candidates = page.getByRole('region', { name: '待尝试' });
  await candidates.getByLabel('按领域筛选').selectOption('C#');
  await candidates.getByRole('button', { name: '添加待尝试' }).click();
  await candidates.getByRole('button', { name: '让智能体推荐' }).click();
  await expect(page).toHaveURL(/#path\/try$/);
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByRole('button', { name: '推荐练习', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const suggestions = assistant.getByRole('region', { name: '练习推荐' });
  await expect(suggestions.getByLabel('练习领域')).toHaveValue('C#');
  await suggestions.getByLabel('练习偏好（可选）').fill('只使用控制台');
  expect(requests).toHaveLength(0);
  await suggestions.getByRole('button', { name: '生成练习建议' }).click();
  await expect(suggestions.getByRole('article', { name: '记录方向键的状态' })).toContainText('松开后状态变为 false。');
  expect(requests[0].focus).toBe('C# 只使用控制台');
  await expect(suggestions.getByRole('article', { name: '无依据的推荐' })).toHaveCount(0);
  await suggestions.getByRole('button', { name: '换一批' }).click();
  const card = suggestions.getByRole('article', { name: '为输入增加边界检查' });
  await expect(card.getByRole('link', { name: /角色移动笔记/ })).toHaveAttribute('href', '#history/' + oldDate);
  await expect(card.getByRole('link', { name: /输入处理/ })).toHaveAttribute('href', '#knowledge/entry-one');
  expect(requests[1].exclude).toContain('记录方向键的状态');
  await expect(suggestions.getByRole('article', { name: '记录方向键的状态' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath('growth-suggestions-mobile.png') });
  await card.getByRole('link', { name: /输入处理/ }).click();
  await expect(page).toHaveURL(/#knowledge\/entry-one$/);
  await expect(assistant).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#path/try');
  const nearby = candidates.getByRole('article', { name: '让角色跳起并落回地面', exact: true });
  const originalSize = await nearby.boundingBox();
  expect(originalSize).not.toBeNull();
  await page.getByRole('button', { name: '恢复学习智能体' }).click();
  const bounds = (await card.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 40, bounds.y + 25, { steps: 5 });
  const dropBox = (await candidates.boundingBox())!;
  await page.mouse.move(dropBox.x - 20, dropBox.y + dropBox.height - 28, { steps: 8 });
  await page.mouse.move(dropBox.x - 22, dropBox.y + dropBox.height - 26);
  await page.mouse.up();
  await expect(candidates.getByRole('article', { name: '为输入增加边界检查' })).toBeVisible();
  await candidates.getByRole('button', { name: '撤销整理' }).click();
  await expect(candidates.getByRole('article', { name: '为输入增加边界检查' })).toHaveCount(0);
  await page.getByRole('link', { name: '已完成', exact: true }).click();
  const completedBoard = page.getByRole('region', { name: '已完成' });
  const completedBounds = (await completedBoard.boundingBox())!;
  await card.dragTo(completedBoard, { sourcePosition: { x: 20, y: 20 },
    targetPosition: { x: 24, y: completedBounds.height - 35 } });
  const draft = page.getByRole('form', { name: '实践记录表单' });
  await expect(draft.getByLabel('成果名称')).toHaveValue('为输入增加边界检查');
  await draft.getByRole('button', { name: '取消', exact: true }).click();
  await expect(completedBoard.getByRole('article', { name: '为输入增加边界检查' })).toHaveCount(0);
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  await card.dragTo(completedBoard, { sourcePosition: { x: 20, y: 20 },
    targetPosition: { x: 24, y: completedBounds.height - 35 } });
  await draft.getByRole('button', { name: '保存实践' }).click();
  const directlyCompleted = completedBoard.getByRole('article', { name: '为输入增加边界检查' });
  await expect(directlyCompleted).toContainText('输入超出范围时返回失败。');
  await directlyCompleted.getByRole('button', { name: '删除实践' }).click();
  await page.getByRole('dialog', { name: '删除实践' }).getByRole('button', { name: '确认删除' }).click();
  await page.getByRole('link', { name: '待尝试', exact: true }).click();
  const returned = candidates.getByRole('article', { name: '为输入增加边界检查' });
  await returned.getByRole('button', { name: '卡片操作' }).click();
  await returned.getByRole('button', { name: '移出待尝试' }).click();
  await page.getByRole('dialog', { name: '移出待尝试' }).getByRole('button', { name: '确认移出' }).click();
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  await card.dragTo(nearby, { sourcePosition: { x: 20, y: 20 }, targetPosition: { x: 15, y: 25 } });
  const createGroup = page.getByRole('dialog', { name: '新建卡组' });
  await createGroup.getByLabel('卡组名称').fill('边界练习');
  await createGroup.getByRole('button', { name: '创建卡组' }).click();
  await expect(candidates.getByRole('link', { name: '打开卡组 边界练习，2 张卡片' })).toBeVisible();
  await candidates.getByRole('button', { name: '撤销整理' }).click();
  await expect(nearby).toBeVisible();
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  await card.getByRole('button', { name: '卡片操作' }).click();
  await card.getByRole('button', { name: '加入待尝试' }).click();
  await card.getByRole('button', { name: '卡片操作' }).click();
  await expect(card.getByRole('button', { name: '已在待尝试' })).toBeDisabled();
  await assistant.getByRole('heading', { name: '学习智能体' }).click();
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  const resized = await nearby.boundingBox();
  expect(resized?.width).toBe(originalSize?.width);
  expect(resized?.height).toBe(originalSize?.height);
  await page.goto('/#path/try');
  await page.reload();
  const saved = candidates.getByRole('article', { name: '为输入增加边界检查' });
  await expect(saved).toContainText('添加一次边界检查。');
  await saved.getByRole('link', { name: '为输入增加边界检查', exact: true }).click();
  await expect(saved).toContainText('输入超出范围时返回失败。');
  await expect(saved.getByRole('link', { name: '输入处理', exact: true })).toHaveAttribute('href', '#knowledge/entry-one');
  await saved.getByRole('link', { name: '返回卡片' }).click();
  await saved.getByRole('button', { name: '卡片操作' }).click();
  await saved.getByRole('button', { name: '我做到了' }).click();
  await expect(assistant).toBeHidden();
  const form = page.getByRole('form', { name: '实践记录表单' });
  await expect(form.getByLabel('成果名称')).toHaveValue('为输入增加边界检查');
  await form.getByText('关联学习日志（1）', { exact: true }).click();
  await expect(form.getByRole('checkbox', { name: /角色移动笔记/ })).toBeChecked();
  await form.getByText('关联知识词条（1）', { exact: true }).click();
  await expect(form.getByRole('checkbox', { name: '输入处理' })).toBeChecked();
  await form.getByRole('button', { name: '保存实践' }).click();
  const completed = page.getByRole('region', { name: '已完成' });
  const completedCard = completed.getByRole('article', { name: '为输入增加边界检查' });
  const confirm = page.getByRole('dialog', { name: '删除实践' });
  await expect(completedCard).toContainText('输入超出范围时返回失败。');
  for (const fromMenu of [true, false]) {
    if (fromMenu) {
      await completed.getByRole('link', { name: '返回卡片' }).click();
      await expect(completedCard).toContainText('添加一次边界检查。');
      await completedCard.getByRole('button', { name: '卡片操作' }).click();
    }
    await completedCard.getByRole('button', { name: '删除实践', exact: true }).click();
    await expect(confirm).toContainText('这是最后一次实践，删除后卡片将回到「待尝试」。');
    await confirm.getByRole('button', { name: '确认删除' }).click();
    await expect(confirm).toHaveCount(0);
    await expect(completedCard).toHaveCount(0);
    await page.getByRole('link', { name: '待尝试', exact: true }).click();
    await saved.getByRole('button', { name: '卡片操作' }).click();
    await saved.getByRole('button', { name: '我做到了' }).click();
    await form.getByRole('button', { name: '保存实践' }).click();
    await expect(completedCard).toContainText('实践已保存。');
    await expect(confirm).toHaveCount(0);
  }
  await page.getByRole('link', { name: '待尝试', exact: true }).click();
  await expect(saved).toHaveCount(0);
});

test('卡组可混合状态、改名和检索定位，备份保留成员', async ({ page, browser }) => {
  const questions: ChatRequest[] = [];
  await page.route('**/api/assistant-chat', async (route) => {
    questions.push(route.request().postDataJSON());
    await route.fulfill({ json: { answer: '可以取名为「角色移动与跳跃」。' } });
  });
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '待尝试' });
  await board.getByRole('button', { name: '新建卡组' }).click();
  const create = page.getByRole('dialog', { name: '新建卡组' });
  await create.getByLabel('卡组名称').fill('角色控制');
  await create.getByRole('button', { name: '创建卡组' }).click();
  const groupOption = page.getByLabel('卡组', { exact: true }).getByRole('option', { name: '角色控制' });
  const groupId = (await groupOption.getAttribute('value'))!;
  const jumpTitle = '让角色跳起并落回地面';
  for (const cardTitle of [title, jumpTitle]) {
    const card = board.getByRole('article', { name: cardTitle, exact: true });
    await card.getByRole('button', { name: '卡片操作' }).click();
    await card.getByRole('button', { name: '移到卡组' }).click();
    const move = page.getByRole('dialog', { name: '移到卡组' });
    await move.getByLabel('目标卡组').selectOption({ label: '角色控制' });
    await move.getByRole('button', { name: '确认移动' }).click();
  }
  const stack = board.getByRole('link', { name: '打开卡组 角色控制，2 张卡片' });
  await expect(board.getByRole('article', { name: title, exact: true })).toHaveCount(0);
  const boardUrl = page.url();
  await stack.click();
  const group = page.getByRole('dialog', { name: '角色控制' });
  await expect(page).toHaveURL(boardUrl);
  await expect(group.getByRole('article')).toHaveCount(2);
  const card = group.getByRole('article', { name: title });
  await card.getByRole('button', { name: '卡片操作' }).click();
  await card.getByRole('button', { name: '询问智能体' }).click();
  await expect(group).toHaveCount(0);
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByText('引用 ' + title)).toBeVisible();
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await stack.click();
  await card.getByRole('button', { name: '卡片操作' }).click();
  await card.getByRole('button', { name: '我做到了' }).click();
  await page.getByRole('button', { name: '保存实践' }).click();
  await page.getByRole('link', { name: '返回卡片' }).click();
  const groupPage = page.getByRole('region', { name: '角色控制' });
  await expect(groupPage.getByRole('heading', { name: '已完成' })).toBeVisible();
  await expect(groupPage.getByRole('heading', { name: '待尝试' })).toBeVisible();

  for (const view of ['/#path/try', '/#path']) {
    await page.goto(view);
    await page.getByRole('link', { name: '打开卡组 角色控制，1 张卡片' }).click();
    await expect(group.getByRole('article')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(group).toHaveCount(0);
  }
  await page.getByRole('link', { name: '打开卡组 角色控制，1 张卡片' }).click({ button: 'right' });
  await page.getByRole('group', { name: '卡组操作' }).getByRole('button', { name: '询问智能体' }).click();
  await expect(assistant.getByText('引用 卡组「角色控制」')).toBeVisible();
  await expect(assistant.getByRole('button', { name: '组内卡片的分类合适吗？' })).toBeVisible();
  await assistant.getByRole('button', { name: '这个卡组叫什么更合适？' }).click();
  expect(questions).toHaveLength(0);
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('可以取名为「角色移动与跳跃」。')).toBeVisible();
  expect(questions[0]).toEqual({ question: '这个卡组叫什么更合适？', history: [], growthGroup: {
    name: '角色控制', totalCards: 2, cards: [
      { title, domains: ['Unity', 'C#'], description: expect.stringContaining('松开后停止'), completed: true },
      { title: jumpTitle, domains: ['Unity', 'C#'], description: expect.stringContaining('跳跃与落地'), completed: false },
    ],
  } });
  await assistant.getByRole('button', { name: '移除卡组' }).click();
  await expect(assistant.getByRole('button', { name: '这个卡组叫什么更合适？' })).toHaveCount(0);
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await page.goto('/#path?' + new URLSearchParams({ group: groupId, view: 'all' }));

  await groupPage.getByRole('button', { name: '管理卡组' }).click();
  const manage = page.getByRole('dialog', { name: '管理卡组' });
  await manage.getByLabel('卡组名称').fill('角色动作练习');
  await manage.getByRole('button', { name: '保存名称' }).click();
  await page.getByRole('button', { name: '检索资料' }).click();
  const search = page.getByRole('dialog', { name: '检索资料' });
  await search.getByRole('button', { name: '实践卡片与卡组' }).click();
  await search.getByRole('searchbox').fill('角色动作练习');
  await search.getByRole('link', { name: jumpTitle, exact: true }).click();
  await expect(board.getByRole('article', { name: jumpTitle }).getByRole('button', { name: '卡片操作' })).toBeFocused();
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(backup.data.growth.groups).toEqual([{ id: groupId, name: '角色动作练习', cardIds: ['preset-move', 'preset-jump'] }]);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件', { exact: true }).setInputFiles({
      name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
    });
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await restored.goto('/#path?' + new URLSearchParams({ group: groupId, view: 'all' }));
    const restoredGroup = restored.getByRole('region', { name: '角色动作练习' });
    await expect(restoredGroup.getByRole('article')).toHaveCount(2);
    await restoredGroup.getByRole('button', { name: '管理卡组' }).click();
    await restored.getByRole('button', { name: '删除卡组' }).click();
    const deleteGroup = restored.getByRole('dialog', { name: '删除卡组' });
    await expect(deleteGroup).toContainText('组内卡片会保留');
    await deleteGroup.getByRole('button', { name: '取消' }).click();
    await expect(restoredGroup.getByRole('article')).toHaveCount(2);
    await restoredGroup.getByRole('button', { name: '管理卡组' }).click();
    await restored.getByRole('button', { name: '删除卡组' }).click();
    await deleteGroup.getByRole('button', { name: '确认删除' }).click();
    await expect(restored.getByRole('region', { name: '已完成' }).getByRole('article', { name: title })).toBeVisible();
    await restored.getByRole('link', { name: '待尝试', exact: true }).click();
    await expect(restored.getByRole('article', { name: jumpTitle })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('拖两张卡片成组，再拖入已有卡组并撤销', async ({ page }) => {
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '待尝试' });
  const first = board.getByRole('article', { name: title, exact: true });
  const second = board.getByRole('article', { name: '让角色跳起并落回地面', exact: true });
  const third = board.getByRole('article', { name: '让角色在待机和移动动作间切换', exact: true });
  await first.dragTo(second, { sourcePosition: { x: 15, y: 85 }, targetPosition: { x: 30, y: 85 } });
  const create = page.getByRole('dialog', { name: '新建卡组' });
  await create.getByLabel('卡组名称').fill('角色动作');
  await create.getByRole('button', { name: '创建卡组' }).click();
  await expect(page).toHaveURL(/#path\/try$/);
  const folder = board.getByRole('link', { name: '打开卡组 角色动作，2 张卡片' });
  await expect(folder).toBeVisible();
  await expect(board.locator('.growth-card-grid').filter({ has: page.getByRole('link', { name: /打开卡组 角色动作/ }) })
    .getByRole('article', { name: '让角色在待机和移动动作间切换', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '已完成', exact: true }).click();
  await expect(page.getByRole('link', { name: /打开卡组 角色动作/ })).toHaveCount(0);
  await page.getByRole('link', { name: '待尝试', exact: true }).click();
  await third.dragTo(board.getByRole('link', { name: '打开卡组 角色动作，2 张卡片' }));
  await expect(board.getByRole('link', { name: '打开卡组 角色动作，3 张卡片' })).toBeVisible();
  const bounds = (await board.boundingBox())!;
  await page.mouse.click(bounds.x - 18, bounds.y + bounds.height - 10, { button: 'right' });
  await page.getByRole('group', { name: '成长记录操作' }).getByRole('button', { name: '撤销整理' }).click();
  await expect(third).toBeVisible();
  await page.reload();
  await folder.click({ button: 'right' });
  await page.getByRole('group', { name: '卡组操作' }).getByRole('button', { name: '打开卡组' }).click();
  const panel = page.getByRole('dialog', { name: '角色动作' });
  await expect(panel.getByRole('article')).toHaveCount(2);
  const member = panel.getByRole('article', { name: title, exact: true });
  await member.click({ button: 'right' });
  await member.getByRole('button', { name: '移出当前卡组' }).click();
  await expect(panel.getByRole('status')).toHaveText('已移出卡组。');
  await expect(panel.getByRole('article')).toHaveCount(1);
  await page.mouse.click(10, 30);
  await expect(panel).toHaveCount(0);
  await expect(first).toBeVisible();
  await board.getByRole('button', { name: '撤销整理' }).click();
  await expect(page).toHaveURL(/#path\/try$/);
  await folder.click();
  const cardBounds = (await member.boundingBox())!;
  const panelBounds = (await panel.boundingBox())!;
  await page.mouse.move(cardBounds.x + 20, cardBounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(cardBounds.x + 40, cardBounds.y + 85, { steps: 5 });
  const belowFolder = panelBounds.y + panelBounds.height + 30;
  await page.mouse.move(panelBounds.x + 40, belowFolder, { steps: 8 });
  await page.mouse.move(panelBounds.x + 42, belowFolder + 2);
  await expect(panel).toHaveAttribute('data-drop-outside', 'true');
  await page.mouse.up();
  await expect(panel.getByRole('article')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(first).toBeVisible();
  await board.getByRole('button', { name: '撤销整理' }).click();
  await expect(folder).toBeVisible();
});

test('卡片右键与键盘菜单联动目标和智能体，完成后移入已完成', async ({ page }, testInfo) => {
  let input: ChatRequest | undefined;
  await page.route('**/api/assistant-chat', async (route) => {
    input = route.request().postDataJSON();
    await route.fulfill({ json: { answer: '先测试按下和松开时的移动。' } });
  });
  await page.setViewportSize({ width: 1700, height: 940 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#path/try');
  const card = page.getByRole('article', { name: title, exact: true });
  const menu = card.getByRole('group', { name: '卡片操作' });
  const trigger = card.getByRole('button', { name: '卡片操作' });
  await expect(card.getByText('Unity', { exact: true })).not.toHaveCSS('color', await card.getByText('C#', { exact: true }).evaluate((element) => getComputedStyle(element).color));
  await page.screenshot({ path: testInfo.outputPath('growth-board-dark.png') });
  await card.click({ button: 'right' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: '设为学习目标' }).click();
  await expect(card.getByText('当前目标')).toBeVisible();
  await page.goto('/#today');
  await expect(page.getByRole('region', { name: '今日学习' }).getByText(title, { exact: true })).toBeVisible();
  await page.goto('/#path/try');
  await trigger.press('Enter');
  await expect(menu.getByRole('button', { name: '我做到了' })).toBeFocused();
  await menu.getByRole('button', { name: '询问智能体' }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByText('引用 ' + title)).toBeVisible();
  expect(input).toBeUndefined();
  await assistant.getByRole('button', { name: '这个练习可以怎么开始？' }).click();
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('先测试按下和松开时的移动。')).toBeVisible();
  expect(input?.growthCard).toEqual({ title, domains: ['Unity', 'C#'], description: expect.stringContaining('松开后停止') });
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await trigger.click();
  await menu.getByRole('button', { name: '我做到了' }).click();
  await page.getByRole('button', { name: '保存实践' }).click();
  await page.getByRole('link', { name: '待尝试', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('link', { name: '已完成', exact: true }).click();
  await expect(card.getByText('当前目标')).toBeVisible();
});

test('成长看板可单选和 Shift 多选，仅将选中的卡片交给智能体分组', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/assistant-chat', async (route) => {
    const request: ChatRequest = route.request().postDataJSON();
    requests.push(request);
    await route.fulfill({ json: { answer: request.growthSelection ? '可以把它们放进「角色控制」。' : '先测试角色移动。' } });
  });
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '待尝试' });
  const jump = '让角色跳起并落回地面';
  const first = board.getByRole('article', { name: title, exact: true });
  const second = board.getByRole('article', { name: jump, exact: true });
  const selection = board.getByRole('group', { name: '所选卡片' });
  await first.click({ position: { x: 14, y: 70 } });
  await expect(first).toHaveAttribute('data-selected', 'true');
  await expect(selection.getByRole('status')).toHaveText('已选 1 张');
  await second.getByRole('link', { name: jump }).click({ modifiers: ['Shift'] });
  await expect(page).toHaveURL(/#path\/try$/);
  await expect(selection.getByRole('status')).toHaveText('已选 2 张');
  await second.press('Shift+Space');
  await expect(selection.getByRole('status')).toHaveText('已选 1 张');
  await second.press('Shift+Space');
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await first.click({ button: 'right' });
  const cardMenu = first.getByRole('group', { name: '卡片操作' });
  const ask = cardMenu.getByRole('button', { name: '询问智能体', exact: true });
  await expect(cardMenu.getByRole('button', { name: '询问如何分组' })).toHaveCount(0);
  await ask.click();
  await expect(cardMenu).toBeHidden();
  await expect(assistant.getByText('引用 ' + title)).toBeVisible();
  const scope = assistant.getByRole('group', { name: '卡片引用范围' });
  await expect(scope.getByRole('button', { name: '当前卡片' })).toHaveAttribute('aria-pressed', 'true');
  const prompts = assistant.getByRole('group', { name: '快捷问题' });
  await expect(prompts.getByRole('button')).toHaveCount(2);
  expect(await prompts.getByRole('button').evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().top === buttons[0].getBoundingClientRect().top))).toBe(true);
  await page.setViewportSize({ width: 320, height: 840 });
  await expect.poll(() => prompts.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await assistant.getByRole('button', { name: '这个练习可以怎么开始？' }).click();
  expect(requests).toHaveLength(0);
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('先测试角色移动。')).toBeVisible();
  expect(requests[0].growthCard?.title).toBe(title);
  expect(requests[0].growthSelection).toBeUndefined();
  await scope.getByRole('button', { name: '所选卡片（2）' }).click();
  await expect(assistant.getByText('引用 2 张选中的卡片')).toBeVisible();
  await assistant.getByRole('button', { name: '这些卡片可以怎么分组？' }).click();
  expect(requests).toHaveLength(1);
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('可以把它们放进「角色控制」。')).toBeVisible();
  expect(requests[1].growthCard).toBeUndefined();
  expect(requests[1].history).toEqual([]);
  expect(requests[1].growthSelection).toEqual({ totalCards: 2, cards: [
    { title, domains: ['Unity', 'C#'], description: expect.stringContaining('松开后停止'), completed: false },
    { title: jump, domains: ['Unity', 'C#'], description: expect.stringContaining('跳跃与落地'), completed: false },
  ] });
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await selection.getByRole('button', { name: '询问智能体', exact: true }).click();
  await expect(assistant.getByRole('button', { name: '这些卡片可以怎么分组？' })).toBeVisible();
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await expect(board.getByRole('link', { name: /打开卡组/ })).toHaveCount(0);
  await board.getByLabel('按领域筛选').selectOption('C#');
  await expect(selection).toHaveCount(0);
  await second.getByRole('link', { name: jump }).click();
  await expect(board.getByRole('heading', { name: jump })).toBeVisible();
});

test('智能体工具栏和问答可打开同一练习推荐面板并保留偏好', async ({ page }) => {
  await seedLearning(page);
  await page.goto('/#history');
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  await assistant.getByRole('button', { name: '推荐练习', exact: true }).click();
  await expect(page).toHaveURL(/#history$/);
  const panel = assistant.getByRole('region', { name: '练习推荐' });
  const preference = panel.getByLabel('练习偏好（可选）');
  await preference.fill('复习输入事件');
  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await page.getByRole('button', { name: '恢复学习智能体' }).click();
  await expect(preference).toHaveValue('复习输入事件');
  await assistant.getByRole('button', { name: '自由问答' }).click();
  await assistant.getByRole('textbox', { name: '输入问题' }).fill('帮我推荐几个练习');
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page).toHaveURL(/#history$/);
  await expect(preference).toHaveValue('复习输入事件');
  await expect(assistant).toBeVisible();
});
