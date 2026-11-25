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
  await page.getByRole('link', { name: '想尝试', exact: true }).click();
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
  const recent = page.getByRole('region', { name: '实践记录' });
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

test('想尝试支持创建、编辑、详情和恢复移出的内置练习', async ({ page }) => {
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '想尝试' });
  const form = page.getByRole('form', { name: '练习卡片表单' });
  await board.getByRole('button', { name: '添加练习' }).click();
  await board.getByRole('button', { name: '自己填写' }).click();
  await form.getByLabel('卡片名称').fill('做一个暂停菜单');
  await form.getByLabel('卡片说明（可选）').fill('学习如何切换暂停状态。');
  await form.getByLabel('验证方法（可选）').fill('恢复时角色可继续移动。');
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
  await preset.getByRole('button', { name: '移出「想尝试」' }).click();
  await page.getByRole('dialog', { name: '移出「想尝试」' }).getByRole('button', { name: '确认移出' }).click();
  await page.reload();
  await expect(preset).toHaveCount(0);
  await board.getByRole('button', { name: '恢复内置练习' }).click();
  await page.getByRole('dialog', { name: '恢复内置练习' }).getByRole('button', { name: '恢复', exact: true }).click();
  await expect(preset).toContainText('测试松开方向键后能否立刻停止。');
  await own.getByRole('button', { name: '卡片操作' }).click();
  await own.getByRole('button', { name: '移出「想尝试」' }).click();
  await page.getByRole('dialog', { name: '移出「想尝试」' }).getByRole('button', { name: '确认移出' }).click();
  await expect(own).toHaveCount(0);
});

test('自定义领域可保存到练习、用于筛选并随实践保留', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#path/try');
  const pending = page.getByRole('region', { name: '想尝试', exact: true });
  const edit = page.getByRole('form', { name: '练习卡片表单' });
  const name = '验证一套输入映射';
  const domain = 'Input System and Gamepad';
  const practiceDomain = '输入设备调试';
  await pending.getByRole('button', { name: '添加练习' }).click();
  await pending.getByRole('button', { name: '自己填写' }).click();
  await edit.getByLabel('卡片名称').fill(name);
  await edit.getByRole('checkbox', { name: 'Unity', exact: true }).check();
  await edit.getByRole('button', { name: '保存卡片' }).click();
  const exercise = pending.getByRole('article', { name, exact: true });
  await exercise.getByRole('button', { name: '编辑卡片', exact: true }).click();
  const custom = edit.getByRole('textbox', { name: '自定义领域', exact: true });
  await custom.fill('  ' + domain + '  ');
  await custom.press('Enter');
  await expect(edit.getByRole('checkbox', { name: domain, exact: true })).toBeChecked();
  await custom.fill(domain.toUpperCase());
  await expect(edit.getByRole('button', { name: '添加领域', exact: true })).toBeDisabled();
  await custom.fill('交互设计');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await edit.getByRole('button', { name: '保存卡片' }).click();
  await page.reload();
  for (const label of ['Unity', domain, '交互设计']) await expect(exercise.getByText(label, { exact: true })).toBeVisible();
  await exercise.getByRole('link', { name: '返回卡片' }).click();
  await pending.getByLabel('按领域筛选').selectOption({ label: domain });
  await expect(pending.getByRole('article')).toHaveCount(1);
  await exercise.getByRole('link', { name, exact: true }).click();
  await exercise.getByRole('button', { name: '我做到了', exact: true }).click();
  const practice = page.getByRole('form', { name: '实践记录表单' });
  await expect(practice.getByRole('checkbox', { name: domain, exact: true })).toBeChecked();
  await practice.getByRole('textbox', { name: '自定义领域', exact: true }).fill(practiceDomain);
  await practice.getByRole('button', { name: '保存实践', exact: true }).click();
  const recent = page.getByRole('region', { name: '实践记录', exact: true });
  await recent.getByRole('link', { name: '返回卡片' }).click();
  await recent.getByLabel('按领域筛选').selectOption({ label: practiceDomain });
  const outcome = recent.getByRole('article', { name, exact: true });
  for (const label of [domain, practiceDomain]) await expect(outcome.getByText(label, { exact: true })).toBeVisible();
});

test('旧节点和任务保留，参考基础不锁住后续节点，目标可直接清除', async ({ page }) => {
  await seedLearning(page);
  await page.goto('/');
  const today = page.getByRole('region', { name: '今日学习' });
  await expect(today.getByText('当前学习目标', { exact: true })).toBeVisible();
  await expect(today.getByText('旧任务', { exact: true })).toBeVisible();
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
  const task = unity.getByRole('listitem').filter({ hasText: '改一下角色移动速度' });
  await task.getByRole('button', { name: '设为目标', exact: true }).click();
  await task.getByRole('button', { name: '删除', exact: true }).click();
  const deletion = page.getByRole('dialog', { name: '删除任务', exact: true });
  await expect(deletion).toContainText('改一下角色移动速度');
  await expect(deletion).toContainText('删除时会同时清除该目标');
  await deletion.getByRole('button', { name: '取消', exact: true }).click();
  await expect(task).toBeVisible();
  await task.getByRole('button', { name: '删除', exact: true }).click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'learning-assistant:current-goal') {
        Storage.prototype.setItem = set;
        throw new Error('模拟当前目标写入失败');
      }
      return set.call(this, key, value);
    };
  });
  await deletion.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(deletion.getByRole('alert')).toHaveText('删除任务失败，请重试。');
  await expect(unity.getByText('改一下角色移动速度', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('learning-assistant:tasks'))).toContain('改一下角色移动速度');
  await deletion.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(task).toHaveCount(0);
  await expect(page.getByRole('region', { name: '实践记录' }).getByRole('article')).toHaveCount(0);
  await page.goto('/#today');
  await expect(page.getByText('可以直接开始学习', { exact: true })).toBeVisible();
});

test('添加和编辑任务原位展开与收起，关闭后归还焦点', async ({ page }) => {
  await seedLearning(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#path/topics');
  await page.getByRole('button', { name: 'Unity 核心工作流', exact: true }).click();
  const topic = page.getByRole('article', { name: 'Unity 核心工作流', exact: true });
  await page.addStyleTag({ content: '@media (prefers-reduced-motion: no-preference) { .growth-task-list { --app-motion-duration: 800ms; } }' });

  const add = topic.getByRole('button', { name: '添加任务', exact: true });
  const edit = topic.getByRole('listitem').filter({ hasText: '旧任务' }).getByRole('button', { name: '编辑', exact: true });
  for (const [trigger, label] of [[add, '添加任务'], [edit, '编辑任务']] as const) {
    const form = topic.getByRole('form', { name: label, exact: true });
    const panel = topic.locator('.inline-reveal').filter({ has: page.locator(`form[aria-label="${label}"]`) });
    const isAnimating = () => panel.evaluate((element) => element.getAnimations().some(
      (animation) => animation instanceof CSSTransition && animation.transitionProperty === 'grid-template-rows',
    ));
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(form.getByLabel('任务名称')).toBeFocused();
    await expect.poll(isAnimating).toBe(true);
    await form.getByLabel('任务名称').fill('取消的任务草稿');
    await form.getByRole('button', { name: '取消', exact: true }).click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveAttribute('inert', '');
    await expect(trigger).toBeFocused();
    await expect.poll(isAnimating).toBe(true);
    await expect(panel).toHaveCount(0);
  }
  await expect(topic.getByText('旧任务', { exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await add.click();
  await expect(topic.locator('.inline-reveal')).toHaveCSS('transition-duration', '0s');
  await topic.getByRole('form', { name: '添加任务', exact: true }).getByRole('button', { name: '取消', exact: true }).click();
  await expect(topic.locator('.inline-reveal')).toHaveCount(0);
  await expect(add).toBeFocused();
});

test('今日和历史日志多选关联任务，改名和完成后仍能双向打开，完整备份可恢复', async ({ page, browser }) => {
  await seedLearning(page);
  await page.goto('/#today');
  const today = page.getByRole('region', { name: '今日学习', exact: true });
  const todayLinks = today.getByRole('region', { name: '关联任务' });
  await today.getByRole('link', { name: '查看任务' }).click();
  const topic = page.getByRole('article', { name: 'Unity 核心工作流', exact: true });
  await expect(topic.locator('[data-task-focus]')).toContainText('旧任务');
  await topic.getByRole('button', { name: '添加任务', exact: true }).click();
  await topic.getByPlaceholder('添加一个可执行任务').fill('补做镜头跟随');
  await topic.getByRole('button', { name: '保存任务', exact: true }).click();
  await page.getByRole('link', { name: '今日学习', exact: true }).click();
  const selection = page.getByRole('region', { name: '选择关联任务' });
  const old = selection.getByRole('checkbox', { name: /^旧任务/ });
  await todayLinks.getByRole('button', { name: '选择任务' }).click();
  await old.check();
  await todayLinks.getByRole('button', { name: '收起任务' }).click();
  await expect(selection).toBeHidden();
  await expect(todayLinks.getByRole('button', { name: '选择任务' })).toBeFocused();
  await expect(todayLinks.getByRole('link')).toHaveCount(0);
  await todayLinks.getByRole('button', { name: '选择任务' }).click();
  await expect(old).not.toBeChecked();
  await old.check();
  await selection.getByRole('searchbox', { name: '筛选学习任务' }).fill('镜头');
  await expect(old).toHaveCount(0);
  await selection.getByRole('checkbox', { name: /^补做镜头跟随/ }).check();
  await selection.getByRole('button', { name: '保存关联' }).click();
  await expect(todayLinks.getByRole('link')).toHaveCount(2);

  await page.goto('/#history/' + oldDate);
  const historyLinks = page.getByRole('region', { name: '历史回顾', exact: true }).getByRole('region', { name: '关联任务' });
  await historyLinks.getByRole('button', { name: '选择任务' }).click();
  await old.check();
  await selection.getByRole('button', { name: '保存关联' }).click();
  await historyLinks.getByRole('link', { name: '旧任务' }).click();
  const task = topic.locator('[data-task-focus]');
  await task.getByRole('button', { name: '编辑', exact: true }).click();
  await task.getByLabel('任务名称').fill('复习角色移动');
  await task.getByRole('button', { name: '保存', exact: true }).click();
  await task.getByRole('checkbox', { name: '完成任务：复习角色移动' }).check();
  await task.getByText('学习日志（2）', { exact: true }).click();
  await task.getByRole('link', { name: /角色移动笔记/ }).click();
  await expect(page.getByLabel('定位学习日期')).toHaveValue(oldDate);
  await expect(historyLinks.getByRole('link', { name: '复习角色移动' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '角色移动笔记' })).toBeVisible();

  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(backup.data.studyLogs.find((log: { date: string }) => log.date === oldDate).taskIds).toEqual(['task-one']);
  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件', { exact: true }).setInputFiles({
      name: 'task-log-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
    });
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await restored.goto('/#path/topics?task=task-one');
    const restoredTask = restored.locator('[data-task-focus]');
    await expect(restoredTask).toContainText('复习角色移动');
    await restoredTask.getByText('学习日志（2）', { exact: true }).click();
    await restoredTask.getByRole('link', { name: /角色移动笔记/ }).click();
    await expect(restored.getByLabel('定位学习日期')).toHaveValue(oldDate);
    await expect(restored.getByRole('region', { name: '关联任务' }).getByRole('link', { name: '复习角色移动' })).toBeVisible();
  } finally { await context.close(); }
});

test('没有任务时可以从日志原位新建，写入失败保留草稿供重试', async ({ page }) => {
  await page.goto('/#today');
  const links = page.getByRole('region', { name: '关联任务', exact: true });
  const selectTasks = links.getByRole('button', { name: '选择任务', exact: true });
  const selection = links.getByRole('region', { name: '选择关联任务' });
  await selectTasks.click();
  await expect(selection.getByText('暂无学习任务。')).toBeVisible();
  await selection.getByRole('button', { name: '添加任务', exact: true }).click();
  const form = selection.getByRole('form', { name: '新建关联任务' });
  const save = form.getByRole('button', { name: '保存任务并关联' });
  const title = form.getByLabel('任务名称');
  await title.fill('验证拾取物引用');
  await form.getByLabel('任务说明').fill('比较两个场景的预制体实例。');
  await expect(save).toBeDisabled();
  await form.getByRole('combobox', { name: '所属主题' }).fill('Unity');
  await form.getByRole('option', { name: 'Unity 核心工作流', exact: true }).click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'learning-assistant:study-logs') {
        Storage.prototype.setItem = set;
        throw new Error('模拟日志写入失败');
      }
      return set.call(this, key, value);
    };
  });
  await save.click();
  await expect(selection.getByRole('alert')).toHaveText('保存任务和关联失败，请重试。');
  await expect(title).toHaveValue('验证拾取物引用');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:tasks') ?? '[]'))).toEqual([]);
  await save.click();
  await expect(selection).toBeHidden();
  await expect(selectTasks).toBeFocused();
  const taskLink = links.getByRole('link', { name: '验证拾取物引用', exact: true });
  await taskLink.click();
  const task = page.getByRole('article', { name: 'Unity 核心工作流' }).locator('[data-task-focus]');
  await expect(task).toContainText('比较两个场景的预制体实例。');
  await expect(task.getByText('学习日志（1）', { exact: true })).toBeVisible();
  await page.goBack();
  await page.reload();
  await expect(taskLink).toHaveCount(1);
});

test('删除任务或主题会解除日志关联，写入失败时回退', async ({ page }) => {
  await seedLearning(page);
  await page.goto('/#path/topics?task=task-one');
  await expect(page.locator('[data-task-focus]')).toContainText('旧任务');
  await page.evaluate((date) => {
    const key = 'learning-assistant:study-logs';
    const logs = JSON.parse(localStorage.getItem(key)!);
    const log = logs.find((item: { date: string }) => item.date === date);
    log.taskIds = ['task-one'];
    localStorage.setItem(key, JSON.stringify(logs));
  }, oldDate);
  await page.reload();
  const task = page.locator('[data-task-focus]');
  const topic = page.getByRole('article', { name: 'Unity 核心工作流', exact: true });
  await expect(task.getByText('学习日志（1）')).toBeVisible();
  await task.getByRole('button', { name: '删除', exact: true }).click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'learning-assistant:study-logs') {
        Storage.prototype.setItem = set;
        throw new Error('模拟日志写入失败');
      }
      return set.call(this, key, value);
    };
  });
  const deletion = page.getByRole('dialog', { name: '删除任务' });
  await deletion.getByRole('button', { name: '确认删除' }).click();
  await expect(deletion.getByRole('alert')).toHaveText('删除任务失败，请重试。');
  await expect(task.getByText('学习日志（1）')).toBeVisible();
  await deletion.getByRole('button', { name: '取消', exact: true }).click();
  await topic.getByRole('button', { name: '删除主题' }).click();
  await page.getByRole('dialog', { name: '删除主题' }).getByRole('button', { name: '确认删除' }).click();
  await expect(topic).toHaveCount(0);
  await page.goto('/#history/' + oldDate);
  await expect(page.getByRole('heading', { name: '角色移动笔记' })).toBeVisible();
  const links = page.getByRole('region', { name: '关联任务', exact: true });
  await links.getByRole('button', { name: '选择任务' }).click();
  await expect(links.getByText('暂无学习任务。')).toBeVisible();
  expect(await page.evaluate((date) => JSON.parse(localStorage.getItem('learning-assistant:study-logs')!)
    .find((item: { date: string }) => item.date === date).taskIds, oldDate)).toBeUndefined();
});

test('参考主题可增改删，主题、任务、完成标记和引用可随备份恢复', async ({ page, browser }) => {
  await seedLearning(page);
  await page.goto('/#path/topics');
  const board = page.getByRole('region', { name: '参考路径与任务' });
  const nav = board.getByRole('navigation', { name: '参考主题' });
  const unity = board.getByRole('article', { name: 'Unity 核心工作流', exact: true });
  await nav.getByRole('button', { name: 'Unity 核心工作流', exact: true }).click();
  await unity.getByRole('button', { name: '设为当前目标' }).click();
  await unity.getByRole('button', { name: '编辑主题' }).click();
  const edit = page.getByRole('dialog', { name: '编辑主题' });
  await edit.getByLabel('主题名称').fill('Unity 场景与组件');
  await edit.getByLabel('主题说明').fill('验证场景切换和组件复用。');
  await edit.getByRole('button', { name: '保存主题' }).click();
  const renamed = board.getByRole('article', { name: 'Unity 场景与组件', exact: true });
  await expect(renamed.getByText('旧任务', { exact: true })).toBeVisible();
  await expect(renamed.getByRole('button', { name: '当前目标', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:current-goal')!).goal.label)).toBe('Unity 场景与组件');

  await board.getByRole('button', { name: '添加主题' }).click();
  const create = page.getByRole('dialog', { name: '添加主题' });
  await create.getByLabel('主题名称').fill('场景切换练习');
  const domain = create.getByRole('combobox', { name: '领域', exact: true });
  await domain.click();
  await create.getByRole('option', { name: 'Unity', exact: true }).click();
  await domain.fill(' ');
  await expect(create.getByRole('button', { name: '保存主题' })).toBeDisabled();
  await domain.fill('  场景工具链  ');
  await expect(create.getByRole('status')).toHaveText('可直接填写新领域。');
  await domain.press('Enter');
  await create.getByText('可参考的主题', { exact: true }).click();
  await create.getByRole('checkbox', { name: 'Unity 场景与组件' }).check();
  await create.getByRole('button', { name: '保存主题' }).click();
  const custom = board.getByRole('article', { name: '场景切换练习', exact: true });
  await expect(nav.getByRole('heading', { name: '场景工具链', exact: true })).toBeVisible();
  await expect(custom.getByText('可参考 Unity 场景与组件')).toBeVisible();
  await custom.getByRole('button', { name: '标记完成', exact: true }).click();
  await expect(custom.getByText('已标记完成')).toBeVisible();

  await nav.getByRole('button', { name: 'Unity 场景与组件', exact: true }).click();
  await renamed.getByRole('button', { name: '设为目标', exact: true }).click();
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const file = await readFile((await (await download).path())!);
  const backup = JSON.parse(file.toString());
  const savedTopic = backup.data.skillTree.topics.find(({ name }: { name: string }) => name === 'Unity 场景与组件');
  expect(savedTopic.id).toBe('unity-foundations');
  expect(backup.data.skillTree.topics.find(({ name }: { name: string }) => name === '场景切换练习').category).toBe('场景工具链');

  await page.getByRole('link', { name: '参考路径与任务', exact: true }).click();
  await renamed.getByRole('button', { name: '删除主题', exact: true }).click();
  const remove = page.getByRole('dialog', { name: '删除主题' });
  await expect(remove).toContainText('及其下的 1 项任务');
  await remove.getByRole('button', { name: '取消' }).click();
  await expect(renamed.getByText('旧任务', { exact: true })).toBeVisible();
  await renamed.getByRole('button', { name: '删除主题', exact: true }).click();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'learning-assistant:current-goal') {
        Storage.prototype.setItem = set;
        throw new Error('Simulated storage write failure');
      }
      set.call(this, key, value);
    };
  });
  await remove.getByRole('button', { name: '确认删除' }).click();
  await expect(remove.getByRole('alert')).toHaveText('保存参考路径失败，请重试。');
  expect(await page.evaluate(() => [
    JSON.parse(localStorage.getItem('learning-assistant:skill-tree')!).topics.some(({ id }: { id: string }) => id === 'unity-foundations'),
    JSON.parse(localStorage.getItem('learning-assistant:tasks')!).length,
    JSON.parse(localStorage.getItem('learning-assistant:current-goal')!).goal.id,
  ])).toEqual([true, 1, 'task-one']);
  await remove.getByRole('button', { name: '确认删除' }).click();
  await page.reload();
  await expect(nav.getByRole('button', { name: 'Unity 场景与组件', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Unity 核心工作流', exact: true })).toHaveCount(0);
  await nav.getByRole('button', { name: /场景切换练习/ }).click();
  await expect(custom.getByText(/可参考/)).toHaveCount(0);
  expect(await page.evaluate(() => [
    JSON.parse(localStorage.getItem('learning-assistant:tasks')!),
    JSON.parse(localStorage.getItem('learning-assistant:current-goal')!).goal,
  ])).toEqual([[], null]);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件').setInputFiles({ name: 'topics.json', mimeType: 'application/json', buffer: file });
    await Promise.all([
      restored.waitForEvent('load'),
      restored.getByRole('button', { name: '确认恢复并刷新' }).click(),
    ]);
    await restored.getByRole('link', { name: '成长记录', exact: true }).click();
    await restored.getByRole('link', { name: '参考路径与任务', exact: true }).click();
    const restoredNav = restored.getByRole('navigation', { name: '参考主题' });
    await expect(restoredNav.getByRole('heading', { name: '场景工具链', exact: true })).toBeVisible();
    await restoredNav.getByRole('button', { name: /场景切换练习/ }).click();
    const restoredTopic = restored.getByRole('article', { name: '场景切换练习', exact: true });
    await expect(restoredTopic.getByText('已标记完成')).toBeVisible();
    await expect(restoredTopic.getByText('可参考 Unity 场景与组件')).toBeVisible();
    await restored.getByRole('button', { name: '添加主题' }).click();
    const restoredCreate = restored.getByRole('dialog', { name: '添加主题' });
    await restoredCreate.getByRole('combobox', { name: '领域', exact: true }).click();
    await restoredCreate.getByRole('option', { name: '场景工具链', exact: true }).click();
    await expect(restoredCreate.getByRole('combobox', { name: '领域', exact: true })).toHaveValue('场景工具链');
    await restoredCreate.getByRole('button', { name: '取消', exact: true }).click();
    await restoredNav.getByRole('button', { name: 'Unity 场景与组件', exact: true }).click();
    const oldTask = restored.getByRole('article', { name: 'Unity 场景与组件', exact: true });
    await expect(oldTask.getByText('旧任务', { exact: true })).toBeVisible();
    await expect(oldTask.getByRole('button', { name: '当前目标', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('智能体主题任务可编辑、取消和添加到原主题，后续提问读取新任务', async ({ page }) => {
  await seedLearning(page);
  const requests: ChatRequest[] = [];
  await page.route('**/api/assistant-chat', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: requests.length === 1 ? {
      answer: '先练习复用角色。',
      tasks: [{ title: '制作角色 Prefab', action: '在两个场景各放一个角色实例。', done: '两个实例都能响应输入。' },
        { title: '不完整', action: '只有行动建议' }],
    } : { answer: '继续验证实例的配置。', tasks: [] } });
  });
  await page.goto('/#path/topics');
  const nav = page.getByRole('navigation', { name: '参考主题' });
  await nav.getByRole('button', { name: 'Unity 核心工作流', exact: true }).click();
  const unity = page.getByRole('article', { name: 'Unity 核心工作流', exact: true });
  await unity.getByRole('button', { name: '询问智能体', exact: true }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByText('引用 主题「Unity 核心工作流」')).toBeVisible();
  await assistant.getByRole('button', { name: '帮我拆成小任务' }).click();
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  const suggestions = assistant.getByRole('region', { name: '任务建议' });
  await expect(suggestions.getByRole('article')).toHaveCount(1);
  await expect(suggestions.getByText('两个实例都能响应输入。', { exact: false })).toBeVisible();
  expect(requests[0].topic).toMatchObject({ name: 'Unity 核心工作流', category: 'Unity',
    related: ['C# 与面向对象基础'], completed: false, totalTasks: 1, tasks: [{ title: '旧任务', completed: false }] });
  expect(requests[0].topic).not.toHaveProperty('id');
  const add = suggestions.getByRole('button', { name: '添加为任务' });
  const form = page.getByRole('dialog', { name: '添加为任务' });

  await add.click();
  await expect(form.getByLabel('任务名称')).toHaveValue('制作角色 Prefab');
  await expect(form.getByLabel('任务说明')).toHaveValue(/完成条件/);
  await form.getByRole('button', { name: '取消' }).click();
  await expect(unity.getByText('制作角色 Prefab', { exact: true })).toHaveCount(0);
  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await nav.getByRole('button', { name: /算法基础保持/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '恢复学习智能体' }).click();
  await add.click();
  await expect(form.getByText('添加到「Unity 核心工作流」')).toBeVisible();
  await form.getByLabel('任务名称').fill('验证两个场景的角色 Prefab');
  await form.getByRole('button', { name: '保存任务' }).click();
  await expect(suggestions.getByRole('status')).toContainText('已将「验证两个场景的角色 Prefab」保存到「Unity 核心工作流」。');
  await assistant.getByRole('textbox', { name: '输入问题' }).fill('帮我推荐几个练习');
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('继续验证实例的配置。')).toBeVisible();
  expect(requests[1].topic?.tasks).toContainEqual({ title: '验证两个场景的角色 Prefab', completed: false });

  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await nav.getByRole('button', { name: 'Unity 核心工作流', exact: true }).click();
  await expect(unity.getByText('验证两个场景的角色 Prefab', { exact: true })).toBeVisible();
  await unity.getByRole('button', { name: '删除主题' }).click();
  await page.getByRole('dialog', { name: '删除主题' }).getByRole('button', { name: '确认删除' }).click();
  await page.getByRole('button', { name: '恢复学习智能体' }).click();
  await expect(add).toBeDisabled();
});

test('完整备份在独立浏览器恢复实践与回链，v3 继续恢复词条和任务', async ({ page, browser }) => {
  await seedLearning(page);
  await page.goto('/#path');
  await recordPreset(page);
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(backup.version).toBe(9);

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
    const recent = restored.getByRole('region', { name: '实践记录' });
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
  await page.getByRole('link', { name: '想尝试', exact: true }).click();
  await expect(page.getByRole('region', { name: '实践记录' })).toBeHidden();
  await expect(page.getByRole('region', { name: '参考路径与任务' })).toBeHidden();
  const candidates = page.getByRole('region', { name: '想尝试' });
  await candidates.getByLabel('按领域筛选').selectOption('C#');
  await candidates.getByRole('button', { name: '添加练习' }).click();
  await candidates.getByRole('button', { name: '让智能体推荐' }).click();
  await expect(page).toHaveURL(/#path\/try$/);
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByRole('textbox', { name: '练习偏好（可选）' })).toBeVisible();
  const suggestions = assistant.getByRole('region', { name: '练习推荐' });
  await expect(suggestions.getByLabel('练习领域')).toHaveValue('C#');
  await assistant.getByRole('textbox', { name: '练习偏好（可选）' }).fill('只使用控制台');
  expect(requests).toHaveLength(0);
  const generate = suggestions.getByRole('button', { name: '生成练习建议' });
  await expect(generate).toHaveClass('note-button');
  await generate.click();
  await expect(suggestions.getByRole('article', { name: '记录方向键的状态' })).toContainText('松开后状态变为 false。');
  expect(requests[0].focus).toBe('C# 只使用控制台');
  await expect(suggestions.getByRole('article', { name: '无依据的推荐' })).toHaveCount(0);
  const nextBatch = suggestions.getByRole('button', { name: '换一批' });
  await expect(nextBatch).toHaveClass('note-button secondary');
  await nextBatch.click();
  const card = suggestions.getByRole('article', { name: '为输入增加边界检查' });
  await expect(card.getByRole('link', { name: /角色移动笔记/ })).toHaveAttribute('href', '#history/' + oldDate);
  await expect(card.getByRole('link', { name: /输入处理/ })).toHaveAttribute('href', '#knowledge/entry-one');
  await expect(card.getByText('验证方法', { exact: true })).toBeVisible();
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
  const boardOrder = () => candidates.locator('.growth-card-grid > .growth-card-slot').evaluateAll((slots) =>
    slots.map((slot) => slot.getAttribute('data-growth-tile')));
  const beforeDrop = await boardOrder();
  const appended = [...beforeDrop, 'card:recommended:为输入增加边界检查'];
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
  await expect.poll(boardOrder).toEqual(appended);
  await expect(candidates.getByRole('status')).toContainText('已添加到「想尝试」末尾');
  await candidates.getByRole('button', { name: '撤销整理' }).click();
  await expect.poll(boardOrder).toEqual(beforeDrop);
  await candidates.getByRole('button', { name: '重做整理' }).click();
  await expect.poll(boardOrder).toEqual(appended);
  await candidates.getByRole('button', { name: '撤销整理' }).click();
  await expect(candidates.getByRole('article', { name: '为输入增加边界检查' })).toHaveCount(0);
  await page.getByRole('link', { name: '实践记录', exact: true }).click();
  const completedBoard = page.getByRole('region', { name: '实践记录' });
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
  await page.getByRole('link', { name: '想尝试', exact: true }).click();
  const returned = candidates.getByRole('article', { name: '为输入增加边界检查' });
  await returned.getByRole('button', { name: '卡片操作' }).click();
  await returned.getByRole('button', { name: '移出「想尝试」' }).click();
  await page.getByRole('dialog', { name: '移出「想尝试」' }).getByRole('button', { name: '确认移出' }).click();
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
  await card.getByRole('button', { name: '加入「想尝试」' }).click();
  await card.getByRole('button', { name: '卡片操作' }).click();
  await expect(card.getByRole('button', { name: '已在「想尝试」' })).toBeDisabled();
  await assistant.getByRole('heading', { name: '学习智能体' }).click();
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  const resized = await nearby.boundingBox();
  expect(resized?.width).toBe(originalSize?.width);
  expect(resized?.height).toBe(originalSize?.height);
  await page.goto('/#path/try');
  await page.reload();
  const saved = candidates.getByRole('article', { name: '为输入增加边界检查' });
  await expect(saved).toContainText('添加一次边界检查。');
  await expect.poll(async () => (await boardOrder()).at(-1)).toBe('card:recommended:为输入增加边界检查');
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
  const completed = page.getByRole('region', { name: '实践记录' });
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
    await expect(confirm).toContainText('这是最后一次实践，删除后卡片将回到「想尝试」。');
    await confirm.getByRole('button', { name: '确认删除' }).click();
    await expect(confirm).toHaveCount(0);
    await expect(completedCard).toHaveCount(0);
    await page.getByRole('link', { name: '想尝试', exact: true }).click();
    await saved.getByRole('button', { name: '卡片操作' }).click();
    await saved.getByRole('button', { name: '我做到了' }).click();
    await form.getByRole('button', { name: '保存实践' }).click();
    await expect(completedCard).toContainText('实践已保存。');
    await expect(confirm).toHaveCount(0);
  }
  await page.getByRole('link', { name: '想尝试', exact: true }).click();
  await expect(saved).toHaveCount(0);
});

test('卡组可混合状态、改名和检索定位，备份保留成员', async ({ page, browser }) => {
  await seedLearning(page);
  const questions: ChatRequest[] = [];
  await page.route('**/api/assistant-chat', async (route) => {
    questions.push(route.request().postDataJSON());
    await route.fulfill({ json: { answer: '可以取名为「角色移动与跳跃」。' } });
  });
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '想尝试' });
  await board.getByRole('button', { name: '新建卡组' }).click();
  const create = page.getByRole('dialog', { name: '新建卡组' });
  await create.getByLabel('卡组名称').fill('角色控制');
  await create.getByRole('button', { name: '创建卡组' }).click();
  const groupOption = page.getByLabel('打开卡组', { exact: true }).getByRole('option', { name: '角色控制' });
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
  const pageCount = page.context().pages().length;
  await stack.click({ modifiers: ['Shift'] });
  const group = page.getByRole('dialog', { name: '角色控制' });
  const groupUrl = boardUrl + '?' + new URLSearchParams({ group: groupId });
  await expect(page).toHaveURL(groupUrl);
  await expect(group.getByRole('article')).toHaveCount(2);
  await expect(group.getByRole('heading', { name: '想尝试', exact: true })).toHaveCount(0);
  expect(page.context().pages()).toHaveLength(pageCount);
  const card = group.getByRole('article', { name: title });
  await card.getByRole('button', { name: '卡片操作' }).click();
  await card.getByRole('button', { name: '带到今日学习', exact: true }).click();
  const replace = page.getByRole('dialog', { name: '替换今日学习内容' });
  await expect(replace).toContainText('替换当前学习目标「旧任务」');
  await page.keyboard.press('Escape');
  await expect(replace).toBeHidden();
  await expect(group).toBeVisible();
  await expect(card.getByText('练习参考', { exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: '卡片操作' }).click();
  await card.getByRole('button', { name: '带到今日学习', exact: true }).click();
  await replace.getByRole('button', { name: '确认替换' }).click();
  await expect(card.getByText('练习参考', { exact: true })).toBeVisible();
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
  await page.getByRole('link', { name: '返回角色控制' }).click();
  await expect(page).toHaveURL(groupUrl);
  await expect(group.getByRole('heading', { name: '实践记录' })).toBeVisible();
  await expect(group.getByRole('heading', { name: '想尝试' })).toBeVisible();

  for (const view of ['/#path/try', '/#path']) {
    await page.goto(view);
    const cover = page.getByRole('link', { name: '打开卡组 角色控制，2 张卡片' });
    await expect(cover.getByText('共 2 张', { exact: true })).toBeVisible();
    await cover.click();
    await expect(group.getByRole('article')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(group).toHaveCount(0);
  }
  await page.getByRole('link', { name: '打开卡组 角色控制，2 张卡片' }).click({ button: 'right' });
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

  await group.getByRole('button', { name: '管理卡组' }).click();
  const manage = page.getByRole('dialog', { name: '管理卡组' });
  await manage.getByLabel('卡组名称').fill('角色动作练习');
  await manage.getByLabel('卡组说明（可选）').fill('练习移动、跳跃和动画切换。');
  await manage.getByRole('button', { name: '保存卡组' }).click();
  const renamedGroup = page.getByRole('dialog', { name: '角色动作练习', exact: true });
  await expect(renamedGroup.getByRole('article')).toHaveCount(2);
  await renamedGroup.getByRole('button', { name: '关闭卡组' }).click();
  await page.getByRole('button', { name: '检索资料' }).click();
  const search = page.getByRole('dialog', { name: '检索资料' });
  await search.getByRole('button', { name: '实践卡片与卡组' }).click();
  await search.getByRole('searchbox').fill('角色动作练习');
  await expect(search.getByText('想尝试 · 角色动作练习', { exact: true })).toBeVisible();
  await expect(search.getByText('实践记录 · 角色动作练习', { exact: true })).toBeVisible();
  await search.getByRole('link', { name: '角色动作练习', exact: true }).click();
  await expect(renamedGroup.getByRole('article')).toHaveCount(2);
  await renamedGroup.getByRole('button', { name: '关闭卡组' }).click();
  await page.getByRole('button', { name: '检索资料' }).click();
  await search.getByRole('link', { name: jumpTitle, exact: true }).click();
  await expect(renamedGroup.getByRole('article', { name: jumpTitle }).getByRole('button', { name: '卡片操作' })).toBeFocused();
  await renamedGroup.getByRole('button', { name: '关闭卡组' }).click();
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(backup.data.growth.groups).toEqual([{ id: groupId, name: '角色动作练习', cardIds: ['preset-move', 'preset-jump'],
    description: '练习移动、跳跃和动画切换。' }]);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件', { exact: true }).setInputFiles({
      name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
    });
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await restored.goto('/#path?' + new URLSearchParams({ group: groupId, view: 'all' }));
    const restoredGroup = restored.getByRole('dialog', { name: '角色动作练习' });
    await expect(restoredGroup.getByRole('article')).toHaveCount(2);
    await restoredGroup.getByRole('button', { name: '管理卡组' }).click();
    await expect(restored.getByLabel('卡组说明（可选）')).toHaveValue('练习移动、跳跃和动画切换。');
    await restored.getByRole('button', { name: '删除卡组' }).click();
    const deleteGroup = restored.getByRole('dialog', { name: '删除卡组' });
    await expect(deleteGroup).toContainText('组内卡片会保留');
    await deleteGroup.getByRole('button', { name: '取消' }).click();
    await expect(restoredGroup.getByRole('article')).toHaveCount(2);
    await restoredGroup.getByRole('button', { name: '管理卡组' }).click();
    await restored.getByRole('button', { name: '删除卡组' }).click();
    await deleteGroup.getByRole('button', { name: '确认删除' }).click();
    await expect(restored.getByRole('region', { name: '实践记录' }).getByRole('article', { name: title })).toBeVisible();
    await restored.getByRole('link', { name: '想尝试', exact: true }).click();
    await expect(restored.getByRole('article', { name: jumpTitle })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('拖动卡片本体，卡片间插入和置于末尾时依次补位，支持撤销和保存', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#path/try');
  const grid = page.getByRole('region', { name: '想尝试' }).locator('.growth-card-grid');
  const cards = grid.getByRole('article');
  const names = () => cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
  await expect(cards.first()).toBeVisible();
  const initial = await names();
  const source = grid.getByRole('article', { name: initial[0]!, exact: true });
  const original = await source.elementHandle();
  const bounds = (await source.boundingBox())!;
  const blank = { x: bounds.x + 45, y: 790 };
  await page.mouse.move(bounds.x + 35, bounds.y + 85);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 90, bounds.y + 95, { steps: 5 });
  await page.mouse.move(blank.x, blank.y, { steps: 12 });
  await page.mouse.move(blank.x + 5, blank.y + 10);
  await expect(source).toHaveAttribute('data-drag-motion', 'moving');
  expect(await source.evaluate((element, before) => element === before && element.matches(':popover-open'), original)).toBe(true);
  await expect.poll(async () => (await source.boundingBox())!.y).toBeGreaterThan(bounds.y + 300);
  await page.mouse.up();
  await expect(source).not.toHaveAttribute('data-drag-motion');
  expect(await source.boundingBox()).toEqual(bounds);
  expect(await names()).toEqual(initial);

  const left = (await cards.nth(2).boundingBox())!;
  const right = (await cards.nth(3).boundingBox())!;
  const gap = (left.x + left.width + right.x) / 2;
  await page.mouse.move(bounds.x + 35, bounds.y + 85);
  await page.mouse.down();
  await page.mouse.move(gap, left.y + 65, { steps: 10 });
  await page.mouse.move(gap, left.y + 67);
  await expect(grid.locator('[data-insertion-side="before"]')).toHaveCount(1);
  await page.mouse.up();
  const inserted = [initial[1], initial[2], initial[0], ...initial.slice(3)];
  await expect.poll(names).toEqual(inserted);
  await expect(source).not.toHaveAttribute('data-drag-motion');
  await expect(page.getByRole('dialog', { name: '新建卡组' })).toHaveCount(0);

  const insertedBounds = (await source.boundingBox())!;
  const end = (await grid.boundingBox())!;
  await page.mouse.move(insertedBounds.x + 35, insertedBounds.y + 85);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width - 40, end.y + end.height - 10, { steps: 10 });
  await page.mouse.move(end.x + end.width - 38, end.y + end.height - 8);
  await expect(grid.locator('[data-insertion-side="after"]')).toHaveCount(1);
  await page.mouse.up();
  const appended = [...initial.slice(1), initial[0]];
  await expect.poll(names).toEqual(appended);
  await page.getByRole('button', { name: '撤销整理' }).click();
  await expect.poll(names).toEqual(inserted);
  await page.getByRole('button', { name: '重做整理' }).click();
  await expect.poll(names).toEqual(appended);
  await page.reload();
  await expect.poll(names).toEqual(appended);
});

test('拖两张卡片成组，再拖入已有卡组并撤销', async ({ page }) => {
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '想尝试' });
  const first = board.getByRole('article', { name: title, exact: true });
  const second = board.getByRole('article', { name: '让角色跳起并落回地面', exact: true });
  const third = board.getByRole('article', { name: '让角色在待机和移动动作间切换', exact: true });
  await first.dragTo(second, { sourcePosition: { x: 15, y: 85 }, targetPosition: { x: 30, y: 85 } });
  const create = page.getByRole('dialog', { name: '新建卡组' });
  await create.getByLabel('卡组名称').fill('角色动作');
  await create.getByLabel('卡组说明（可选）').fill('验证角色移动与落地。');
  await create.getByRole('button', { name: '创建卡组' }).click();
  await expect(page).toHaveURL(/#path\/try$/);
  const folder = board.getByRole('link', { name: '打开卡组 角色动作，2 张卡片' });
  await expect(folder).toBeVisible();
  await expect(folder).toContainText('验证角色移动与落地。');
  await expect(folder.getByText('Unity', { exact: true })).toBeVisible();
  await board.getByRole('button', { name: '卡组操作 · 角色动作' }).click();
  await page.getByRole('group', { name: '卡组操作' }).getByRole('button', { name: '选中组内卡片' }).click();
  const panel = page.getByRole('dialog', { name: '角色动作' });
  await expect(panel.getByRole('group', { name: '所选卡片' })).toContainText('已选 2 张');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  const otherTile = board.getByRole('article', { name: '用字典统计物品数量' });
  const targetBox = (await otherTile.boundingBox())!;
  await folder.dragTo(otherTile, { targetPosition: { x: targetBox.width - 8, y: 64 } });
  const tileOrder = () => board.locator('[data-growth-tile]').evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-growth-tile')));
  await expect.poll(async () => (await tileOrder()).findIndex((id) => id?.startsWith('group:'))).toBeGreaterThan(0);
  const moved = await tileOrder();
  await board.getByRole('button', { name: '撤销整理' }).click();
  await expect.poll(async () => (await tileOrder()).findIndex((id) => id?.startsWith('group:'))).toBe(0);
  await board.getByRole('button', { name: '重做整理' }).click();
  await expect.poll(tileOrder).toEqual(moved);
  await page.reload();
  await expect.poll(tileOrder).toEqual(moved);
  await expect(board.locator('.growth-card-grid').filter({ has: page.getByRole('link', { name: /打开卡组 角色动作/ }) })
    .getByRole('article', { name: '让角色在待机和移动动作间切换', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '实践记录', exact: true }).click();
  await expect(page.getByRole('link', { name: /打开卡组 角色动作/ })).toHaveCount(0);
  await page.getByRole('link', { name: '想尝试', exact: true }).click();
  await third.dragTo(board.getByRole('link', { name: '打开卡组 角色动作，2 张卡片' }));
  await expect(board.getByRole('link', { name: '打开卡组 角色动作，3 张卡片' })).toBeVisible();
  const bounds = (await board.boundingBox())!;
  await page.mouse.click(bounds.x - 18, bounds.y + bounds.height - 10, { button: 'right' });
  await page.getByRole('group', { name: '成长记录操作' }).getByRole('button', { name: '撤销整理' }).click();
  await expect(third).toBeVisible();
  await page.reload();
  await folder.click({ button: 'right' });
  await page.getByRole('group', { name: '卡组操作' }).getByRole('button', { name: '打开卡组' }).click();
  await expect(panel.getByRole('article')).toHaveCount(2);
  const member = panel.getByRole('article', { name: title, exact: true });
  const memberNames = () => panel.getByRole('article').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
  const memberOrder = await memberNames();
  const other = panel.getByRole('article', { name: '让角色跳起并落回地面', exact: true });
  await expect(panel).toHaveCSS('transform', 'none');
  const otherBounds = (await other.boundingBox())!;
  await member.dragTo(other, { targetPosition: { x: memberOrder[0] === title ? otherBounds.width - 8 : 8, y: 65 } });
  await expect.poll(memberNames).toEqual([...memberOrder].reverse());
  await panel.getByRole('button', { name: '撤销整理' }).click();
  await expect.poll(memberNames).toEqual(memberOrder);
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
  await expect(panel).toHaveCSS('transform', 'none');
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

test('在看板空白处按住左键拖动可框选多张卡片', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '想尝试' });
  const cards = board.getByRole('article');
  await expect(cards.nth(2)).toBeVisible();
  const first = (await cards.nth(0).boundingBox())!;
  const second = (await cards.nth(1).boundingBox())!;
  const third = (await cards.nth(2).boundingBox())!;
  const x = (second.x + second.width + third.x) / 2;
  await page.mouse.move(x, first.y + 95);
  await page.mouse.down();
  await page.mouse.move(first.x + 15, first.y + 15, { steps: 12 });
  await expect(board.locator('.growth-selection-box')).toBeVisible();
  await page.mouse.up();
  await expect(board.getByRole('group', { name: '所选卡片' })).toContainText('已选 2 张');
  await expect(cards.nth(0)).toHaveAttribute('data-selected', 'true');
  await expect(cards.nth(1)).toHaveAttribute('data-selected', 'true');
  await expect(cards.nth(2)).not.toHaveAttribute('data-selected');
  await expect(board.locator('.growth-selection-box')).toHaveCount(0);
  await cards.nth(1).click({ button: 'right' });
  await expect(board.getByRole('group', { name: '所选卡片操作' }).getByRole('button', { name: '移到卡组' })).toBeVisible();
});

test('卡片右键与键盘菜单联动练习参考和智能体，记录后移入实践记录', async ({ page }, testInfo) => {
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
  await menu.getByRole('button', { name: '带到今日学习' }).click();
  await expect(card.getByText('练习参考')).toBeVisible();
  await page.goto('/#today');
  const today = page.getByRole('region', { name: '今日学习' });
  await expect(today.getByText(title, { exact: true })).toBeVisible();
  await expect(today.getByText('练习参考', { exact: true })).toBeVisible();
  await expect(today.getByRole('button', { name: '移除练习参考' })).toBeVisible();
  await page.getByRole('button', { name: '开发者工具', exact: true }).click();
  await page.getByRole('button', { name: /模拟完成 1 个番茄钟/ }).click();
  await expect.poll(() => page.evaluate((label) => JSON.parse(localStorage.getItem('learning-assistant:study-logs')!)
    .some((log: { tags: string[] }) => log.tags.includes(`练习参考：${label}`)), title)).toBe(true);
  await page.getByRole('button', { name: '开发者工具', exact: true }).click();
  await page.goto('/#path/try');
  await trigger.press('Enter');
  await expect(menu.getByRole('button', { name: '我做到了' })).toBeFocused();
  await menu.getByRole('button', { name: '询问智能体' }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByText('引用 ' + title)).toBeVisible();
  expect(input).toBeUndefined();
  const prompts = assistant.getByRole('group', { name: '快捷问题' });
  await expect(prompts.getByRole('button')).toHaveCount(2);
  expect(await prompts.getByRole('button').evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().top === buttons[0].getBoundingClientRect().top))).toBe(true);
  await page.setViewportSize({ width: 320, height: 840 });
  await expect.poll(() => prompts.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await assistant.getByRole('button', { name: '这个练习可以怎么开始？' }).click();
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('先测试按下和松开时的移动。')).toBeVisible();
  expect(input?.growthCard).toEqual({ title, domains: ['Unity', 'C#'], description: expect.stringContaining('松开后停止') });
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await page.setViewportSize({ width: 1700, height: 940 });
  await trigger.click();
  await menu.getByRole('button', { name: '我做到了' }).click();
  await page.getByRole('button', { name: '保存实践' }).click();
  await page.getByRole('link', { name: '想尝试', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('link', { name: '实践记录', exact: true }).click();
  await expect(card.getByText('练习参考')).toBeVisible();
});

test('成长看板可单选和 Shift 多选，仅将选中的卡片交给智能体分组', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/assistant-chat', async (route) => {
    const request: ChatRequest = route.request().postDataJSON();
    requests.push(request);
    await route.fulfill({ json: { answer: request.growthSelection ? '可以把它们放进「角色控制」。' : '先测试角色移动。' } });
  });
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '想尝试' });
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
  const cardMenu = first.getByRole('group', { name: '所选卡片操作' });
  const ask = cardMenu.getByRole('button', { name: '询问智能体', exact: true });
  await expect(cardMenu).toContainText('已选 2 张卡片');
  await expect(cardMenu.getByRole('button', { name: '带到今日学习' })).toHaveCount(0);
  await ask.click();
  await expect(cardMenu).toBeHidden();
  await expect(assistant.getByText('引用 2 张选中的卡片')).toBeVisible();
  await expect(assistant.getByRole('button', { name: '当前卡片' })).toHaveCount(0);
  await assistant.getByRole('button', { name: '这些卡片可以怎么分组？' }).click();
  expect(requests).toHaveLength(0);
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('可以把它们放进「角色控制」。')).toBeVisible();
  expect(requests[0].growthCard).toBeUndefined();
  expect(requests[0].history).toEqual([]);
  expect(requests[0].growthSelection).toEqual({ totalCards: 2, cards: [
    { title, domains: ['Unity', 'C#'], description: expect.stringContaining('松开后停止'), completed: false },
    { title: jump, domains: ['Unity', 'C#'], description: expect.stringContaining('跳跃与落地'), completed: false },
  ] });
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await selection.getByRole('button', { name: '询问智能体', exact: true }).click();
  await expect(assistant.getByRole('button', { name: '这些卡片可以怎么分组？' })).toBeVisible();
  await assistant.getByRole('button', { name: '关闭学习智能体' }).click();
  await expect(board.getByRole('link', { name: /打开卡组/ })).toHaveCount(0);
  await board.getByLabel('按领域筛选').selectOption('C#');
  await expect(selection).toHaveCount(0);
  await second.getByRole('link', { name: jump }).click();
  await expect(board.getByRole('heading', { name: jump })).toBeVisible();
});

test('多选菜单的移动和移出按选区执行，图标与快捷键可多步撤销和重做', async ({ page }) => {
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '想尝试' });
  const undo = board.getByRole('button', { name: '撤销整理' });
  const redo = board.getByRole('button', { name: '重做整理' });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await board.getByRole('button', { name: '新建卡组' }).click();
  const create = page.getByRole('dialog', { name: '新建卡组' });
  await create.getByLabel('卡组名称').fill('批量整理');
  await create.getByRole('button', { name: '创建卡组' }).click();
  const jump = '让角色跳起并落回地面';
  const first = board.getByRole('article', { name: title, exact: true });
  const second = board.getByRole('article', { name: jump, exact: true });
  const outside = board.getByRole('article', { name: '用字典统计物品数量', exact: true });
  await first.click({ position: { x: 12, y: 70 } });
  await second.click({ modifiers: ['Shift'], position: { x: 12, y: 70 } });
  await outside.click({ button: 'right' });
  const menu = outside.getByRole('group', { name: '所选卡片操作' });
  await expect(menu.getByRole('button', { name: '编辑卡片' })).toHaveCount(0);
  await menu.getByRole('button', { name: '移到卡组' }).click();
  const move = page.getByRole('dialog', { name: '移到卡组' });
  await expect(move).toContainText('移动所选的 2 张卡片');
  await move.getByLabel('目标卡组').selectOption({ label: '批量整理' });
  await move.getByRole('button', { name: '确认移动' }).click();
  const stack = board.getByRole('link', { name: '打开卡组 批量整理，2 张卡片' });
  await expect(stack).toBeVisible();
  await expect(outside).toBeVisible();
  await expect(first).toHaveCount(0);
  await expect(second).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await redo.click();
  await stack.click();
  const folder = page.getByRole('dialog', { name: '批量整理' });
  const member1 = folder.getByRole('article', { name: title, exact: true });
  const member2 = folder.getByRole('article', { name: jump, exact: true });
  await member1.click({ position: { x: 12, y: 70 } });
  await member2.click({ modifiers: ['Shift'], position: { x: 12, y: 70 } });
  await member2.click({ button: 'right' });
  await member2.getByRole('button', { name: '移出当前卡组' }).click();
  await expect(folder.getByRole('article')).toHaveCount(0);
  await folder.getByRole('button', { name: '撤销整理' }).click();
  await expect(folder.getByRole('article')).toHaveCount(2);
  await page.keyboard.press('Control+Shift+Z');
  await expect(folder.getByRole('article')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(folder.getByRole('article')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await undo.click();
  await expect(undo).toBeDisabled();
  await expect(board.getByLabel('打开卡组', { exact: true }).locator('option')).toHaveCount(1);
  await page.keyboard.press('Control+y');
  await expect(board.getByLabel('打开卡组', { exact: true }).locator('option')).toHaveCount(2);
  await expect(first).toBeVisible();
  await first.click({ position: { x: 12, y: 70 } });
  await second.click({ modifiers: ['Shift'], position: { x: 12, y: 70 } });
  await first.click({ button: 'right' });
  await first.getByRole('button', { name: '移出「想尝试」' }).click();
  const remove = page.getByRole('dialog', { name: '移出「想尝试」' });
  await expect(remove).toContainText('将所选的 2 张卡片移出');
  await remove.getByRole('button', { name: '确认移出' }).click();
  await expect(first).toHaveCount(0);
  await expect(second).toHaveCount(0);
  await expect(outside).toBeVisible();
  await expect(redo).toBeDisabled();
  await undo.click();
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
});

test('多选卡片可从移动窗口新建卡组，创建与移入可一步撤销', async ({ page }) => {
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '想尝试' });
  const first = board.getByRole('article', { name: title, exact: true });
  const second = board.getByRole('article', { name: '让角色跳起并落回地面', exact: true });
  const outside = board.getByRole('article', { name: '用字典统计物品数量', exact: true });
  await first.click({ position: { x: 12, y: 70 } });
  await second.click({ modifiers: ['Shift'], position: { x: 12, y: 70 } });

  const create = page.getByRole('dialog', { name: '新建卡组' });
  const openCreate = async () => {
    await first.click({ button: 'right' });
    await first.getByRole('group', { name: '所选卡片操作' }).getByRole('button', { name: '移到卡组' }).click();
    const move = page.getByRole('dialog', { name: '移到卡组' });
    await move.getByLabel('目标卡组').selectOption({ label: '新建卡组…' });
    await expect(create).toContainText('创建后移入所选的 2 张卡片');
  };
  await openCreate();
  await create.getByLabel('卡组名称').fill('录入后取消');
  await create.getByRole('button', { name: '取消', exact: true }).click();
  await expect(board.getByLabel('打开卡组', { exact: true }).getByRole('option')).toHaveCount(1);
  await expect(board.getByRole('group', { name: '所选卡片' })).toContainText('已选 2 张');

  await openCreate();
  await create.getByLabel('卡组名称').fill('角色动作练习');
  await create.getByRole('button', { name: '创建卡组' }).click();
  const stack = board.getByRole('link', { name: '打开卡组 角色动作练习，2 张卡片' });
  await expect(stack).toBeVisible();
  await expect(first).toHaveCount(0);
  await expect(second).toHaveCount(0);
  await expect(outside).toBeVisible();
  const undo = board.getByRole('button', { name: '撤销整理' });
  await undo.click();
  await expect(stack).toHaveCount(0);
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect(undo).toBeDisabled();
  await board.getByRole('button', { name: '重做整理' }).click();
  await expect(stack).toBeVisible();
});

test('智能体分组可逐组确认、加入已有卡组并撤销重做', async ({ page }) => {
  const selected = [title, '让角色跳起并落回地面', '用字典统计物品数量', '让一个事件触发两种反馈'];
  const requests: ChatRequest[] = [];
  await page.route('**/api/assistant-chat', async (route) => {
    const request: ChatRequest = route.request().postDataJSON();
    requests.push(request);
    const invalid = request.question === '再给一组';
    await route.fulfill({ json: {
      answer: invalid ? '另一轮分析。' : '可以按练习主题归为两组。',
      groups: invalid ? [{ name: '无效分组', members: [1, 5] }] : [
        { name: '角色控制', members: [1, 2], reason: '这两项都在练习角色移动。' },
        { name: 'C# 练习', members: [3, 4], reason: '这两项可用 C# 单独完成。' },
      ],
    } });
  });
  await page.goto('/#path/try');
  const board = page.getByRole('region', { name: '想尝试' });
  await board.getByRole('button', { name: '新建卡组' }).click();
  const create = page.getByRole('dialog', { name: '新建卡组' });
  await create.getByLabel('卡组名称').fill('c# 练习');
  await create.getByRole('button', { name: '创建卡组' }).click();

  const cards = selected.map((name) => board.getByRole('article', { name, exact: true }));
  await cards[0].click({ position: { x: 12, y: 70 } });
  for (const card of cards.slice(1)) await card.click({ modifiers: ['Shift'], position: { x: 12, y: 70 } });
  await board.getByRole('group', { name: '所选卡片' }).getByRole('button', { name: '询问智能体' }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await assistant.getByRole('button', { name: '这些卡片可以怎么分组？' }).click();
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  const first = assistant.getByRole('article', { name: '角色控制', exact: true });
  const second = assistant.getByRole('article', { name: 'c# 练习', exact: true });
  const confirm = page.getByRole('dialog', { name: '应用分组建议' });
  await expect(first).toContainText('这两项都在练习角色移动。');
  await expect(first.getByRole('listitem')).toHaveCount(2);
  await expect(second).toContainText('加入已有卡组');
  expect(requests[0].growthSelection?.cards.map(({ title }) => title)).toEqual(selected);
  expect(requests[0].growthSelection).not.toHaveProperty('cardIds');
  for (const card of cards) await expect(card).toBeVisible();

  await second.getByRole('button', { name: '应用这组' }).click();
  await expect(confirm).toContainText('将下列卡片移到已有卡组「c# 练习」');
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  await expect(assistant).toBeVisible();
  await expect(cards[2]).toBeVisible();
  await expect(cards[3]).toBeVisible();

  await first.getByRole('button', { name: '应用这组' }).click();
  await confirm.getByLabel('目标卡组名称').fill('角色动作');
  await confirm.getByRole('button', { name: '确认应用' }).click();
  const renamed = assistant.getByRole('article', { name: '角色动作', exact: true });
  const stack = board.getByRole('link', { name: '打开卡组 角色动作，2 张卡片' });
  await expect(stack).toBeVisible();
  await expect(renamed.getByRole('button', { name: '应用这组' })).toBeDisabled();
  await expect(cards[0]).toHaveCount(0);
  await expect(cards[2]).toBeVisible();

  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await board.getByRole('button', { name: '撤销整理' }).click();
  await expect(stack).toHaveCount(0);
  await expect(cards[0]).toBeVisible();
  const restoreAssistant = page.getByRole('button', { name: '恢复学习智能体' });
  await restoreAssistant.click();
  await expect(renamed.getByRole('button', { name: '应用这组' })).toBeEnabled();
  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await board.getByRole('button', { name: '重做整理' }).click();
  await expect(stack).toBeVisible();

  const desktop = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await restoreAssistant.click();
  await second.getByRole('button', { name: '应用这组' }).click();
  await confirm.getByRole('button', { name: '取消' }).click();
  await expect(assistant).toBeVisible();
  await second.getByRole('button', { name: '应用这组' }).click();
  await confirm.getByRole('button', { name: '确认应用' }).click();
  await expect(second).toContainText('已在此卡组');
  await page.setViewportSize(desktop);
  await expect(board.getByRole('link', { name: '打开卡组 c# 练习，2 张卡片' })).toBeVisible();

  await assistant.getByRole('textbox', { name: '输入问题' }).fill('再给一组');
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('另一轮分析。')).toBeVisible();
  await expect(assistant.getByRole('article', { name: '无效分组' })).toHaveCount(0);
});

test('对话快捷问题和手动发送可打开同一练习推荐并保留偏好', async ({ page }) => {
  await seedLearning(page);
  await page.route('**/api/growth-suggestions', (route) => route.fulfill({ json: { suggestions: [] } }));
  await page.goto('/#history');
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  await assistant.getByText('试试这样问', { exact: true }).click();
  await assistant.getByRole('button', { name: '推荐练习', exact: true }).click();
  await expect(page).toHaveURL(/#history$/);
  const preference = assistant.getByRole('textbox', { name: '练习偏好（可选）' });
  await preference.fill('复习输入事件');
  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await page.getByRole('button', { name: '恢复学习智能体' }).click();
  await expect(preference).toHaveValue('复习输入事件');
  await assistant.getByText('试试这样问', { exact: true }).click();
  await assistant.getByRole('button', { name: '退出当前情境', exact: true }).click();
  await assistant.getByRole('textbox', { name: '输入问题' }).fill('帮我推荐几个练习');
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page).toHaveURL(/#history$/);
  await expect(preference).toHaveValue('复习输入事件');
  await expect(assistant).toBeVisible();
});
