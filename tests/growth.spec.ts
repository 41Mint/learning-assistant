import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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
  await page.getByText('可以尝试', { exact: true }).click();
  await page.getByRole('article', { name: title, exact: true }).getByRole('button', { name: '我做到了' }).click();
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
  const recent = page.getByRole('region', { name: '最近做到' });
  const outcome = recent.getByRole('article', { name: title, exact: true });
  await outcome.getByRole('button', { name: '追加实践' }).click();
  const form = page.getByRole('form', { name: '实践记录表单' });
  await form.getByLabel('这次做了什么（可选）').fill('换个场景重新实现');
  await form.getByRole('button', { name: '保存实践' }).click();
  await page.reload();
  for (const domain of ['C#', 'Unity']) {
    await page.getByLabel('按领域筛选').selectOption(domain);
    await expect(outcome).toContainText('2 次实践');
  }
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
  page.once('dialog', (dialog) => dialog.accept());
  await outcome.getByRole('button', { name: '删除实践' }).first().click();
  await expect(outcome).toContainText('1 次实践');
  await expect(outcome.getByRole('link', { name: /角色移动笔记/ })).toBeVisible();

  await recent.getByRole('button', { name: '记录自定义成果' }).click();
  await form.getByLabel('成果名称').fill('让拾取计数出现在屏幕上');
  await form.getByRole('checkbox', { name: 'C#', exact: true }).check();
  await form.getByRole('button', { name: '保存实践' }).click();
  await expect(recent.getByRole('article', { name: '让拾取计数出现在屏幕上' })).toBeVisible();
});

test('旧节点和任务保留，参考基础不锁住后续节点，目标可直接清除', async ({ page }) => {
  await seedLearning(page);
  await page.goto('/');
  await page.getByRole('button', { name: '清除当前目标' }).click();
  await expect(page.getByText('可以直接开始学习', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('可以直接开始学习', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '成长记录', exact: true }).click();
  await page.getByText('参考路径与任务', { exact: true }).click();
  const unity = page.getByRole('article', { name: 'Unity 核心工作流', exact: true });
  const algorithm = page.getByRole('article', { name: '算法基础保持', exact: true });
  await expect(algorithm.getByText('已标记完成', { exact: true })).toBeVisible();
  await expect(unity.getByText('旧任务', { exact: true })).toBeVisible();
  await expect(unity.getByText('可参考 C# 与面向对象基础')).toBeVisible();
  await unity.getByRole('button', { name: '标记完成', exact: true }).click();
  await expect(unity.getByRole('button', { name: '撤销完成' })).toBeVisible();
  await unity.getByPlaceholder('添加一个可执行任务').fill('改一下角色移动速度');
  await unity.getByRole('button', { name: '添加任务', exact: true }).click();
  await expect(unity.getByText('改一下角色移动速度', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '最近做到' }).getByRole('article')).toHaveCount(0);
});

test('v4 在独立浏览器恢复实践与回链，v3 继续恢复词条和任务', async ({ page, browser }) => {
  await seedLearning(page);
  await page.goto('/#path');
  await recordPreset(page);
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(backup.version).toBe(4);

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
    const recent = restored.getByRole('region', { name: '最近做到' });
    await expect(recent.getByRole('article', { name: title })).toContainText('跟教程实现移动');
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
    await restored.getByText('参考路径与任务', { exact: true }).click();
    await expect(restored.getByRole('article', { name: 'Unity 核心工作流' }).getByText('旧任务', { exact: true })).toBeVisible();
    await restored.getByRole('link', { name: '知识词条', exact: true }).click();
    await expect(restored.getByRole('button', { name: /输入处理/ })).toBeVisible();
  } finally {
    await context.close();
  }
});
