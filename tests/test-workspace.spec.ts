import { expect, test } from '@playwright/test';

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
  await board.getByRole('link', { name: /打开卡组 预制体与场景复用/ }).click();
  const folder = page.getByRole('dialog', { name: '预制体与场景复用', exact: true });
  await expect(folder.getByRole('heading', { name: '想尝试', exact: true })).toBeVisible();
  await expect(folder.getByRole('link', { name: '观察预制体实例的覆盖值' })).toBeVisible();
  await folder.getByRole('link', { name: '在两个场景复用拾取物预制体' }).click();
  const outcome = board.getByRole('article', { name: '在两个场景复用拾取物预制体' });
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
