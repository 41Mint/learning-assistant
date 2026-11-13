import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const date = '2026-11-05';
const script = 'Assets/Scripts/InputManager.cs';
const logTitle = date + ' · 点击实践记录';

async function seedRelations(page: Page, extraLogs = 0) {
  await page.addInitScript(({ date, extraLogs }) => {
    if (localStorage.getItem('relations-test-seeded')) return;
    localStorage.setItem('relations-test-seeded', '1');
    const makeLog = (id: string, date: string, title: string) => ({ id, date, content: '# ' + title, tags: [], knowledgePoints: [], duration: 0, createdAt: 1, updatedAt: 1 });
    const extra = Array.from({ length: extraLogs }, (_, index) => makeLog('extra-' + index, `2026-10-${index + 10}`, '练习 ' + index));
    localStorage.setItem('learning-assistant:study-logs', JSON.stringify([makeLog('click-log', date, '点击实践记录'), ...extra]));
    localStorage.setItem('learning-assistant:knowledge', JSON.stringify({
      version: 1,
      entries: [['click-entry', '点击判定'], ['input-entry', '输入事件'], ['empty-entry', '空白词条']].map(([id, title]) => ({
        id, title, aliases: [], category: 'Unity', content: '', createdAt: 1, updatedAt: 1,
      })),
      logLinks: [{ id: 'click-log-entry', logId: 'click-log', entryId: 'click-entry', note: '原日志关联情境' },
        ...extra.map(({ id }) => ({ id: 'link-' + id, logId: id, entryId: 'click-entry', note: '' }))],
      relations: [{ id: 'click-input', sourceId: 'click-entry', targetId: 'input-entry' }],
    }));
  }, { date, extraLogs });
  await page.goto('/#history/' + date);
  return page.evaluate(async (path) => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const store = useProjectCodeStore.getState();
    const versionId = await store.saveVersion({
      project: { name: '打地鼠练习', repositoryUrl: '', tutorialUrl: '' },
      path, content: 'public class InputManager { }', githubUrl: '', note: '第一版',
    }, { kind: 'log', id: 'click-log' });
    await store.linkVersion(versionId, { kind: 'entry', id: 'click-entry' });
    return versionId;
  }, script);
}

function relationGraph(page: Page) {
  return page.getByRole('group', { name: '直接关系图', exact: true });
}

function relationButton(page: Page, label: string, title: string) {
  return relationGraph(page).getByRole('button', { name: `查看连线 ${label} · ${title}`, exact: true });
}

async function annotate(page: Page, title: string, label: string, note: string) {
  await relationButton(page, '相关', title).click();
  const form = page.getByRole('form', { name: '编辑关系', exact: true });
  await form.getByLabel('连线标签').fill(label);
  await form.getByLabel('补充说明（可选）').fill(note);
  await form.getByRole('button', { name: '保存关系', exact: true }).click();
  await expect(form.getByRole('status')).toHaveText('关系已保存。');
  await expect(relationButton(page, label, title)).toHaveAttribute('aria-pressed', 'true');
}

test('独立关系图复用旧关联，四类连线的说明可从两端查看并随备份恢复', async ({ page, browser }, testInfo) => {
  const codeId = await seedRelations(page);
  await page.getByRole('link', { name: '查看关系', exact: true }).click();
  await expect(page).toHaveURL(/#relations\/log\/click-log$/);
  const graph = relationGraph(page);
  await expect(graph.getByRole('link')).toHaveCount(3);
  await relationButton(page, '相关', '点击判定').click();
  await expect(page.getByRole('complementary', { name: '连线详情' })).toContainText('原日志关联情境');
  await annotate(page, '点击判定', '学习情境', '当时用日志记录碰撞判定。');
  await annotate(page, 'InputManager.cs', '记录验证', '记录了这份脚本的验证过程。');

  await graph.getByRole('link', { name: /打开代码版本.*InputManager.cs/ }).click();
  await expect(page.getByRole('heading', { name: script, exact: true })).toBeVisible();
  await page.getByRole('link', { name: '查看关系', exact: true }).click();
  await expect(relationButton(page, '记录验证', logTitle)).toBeVisible();
  await annotate(page, '点击判定', '实现示例', '这是点击判定的脚本示例。');
  await graph.getByRole('link', { name: /打开知识词条.*点击判定/ }).click();
  await expect(page.getByRole('region', { name: '词条详情' }).getByText('这是点击判定的脚本示例。')).toHaveCount(0);
  await page.getByRole('link', { name: '查看关系', exact: true }).click();
  await expect(relationButton(page, '实现示例', 'InputManager.cs')).toBeVisible();
  await expect(relationButton(page, '学习情境', logTitle)).toBeVisible();
  await annotate(page, '输入事件', '前置概念', '先理解输入事件，再实现点击。');
  await page.reload();
  await relationButton(page, '前置概念', '输入事件').click();
  await expect(page.getByLabel('补充说明（可选）')).toHaveValue('先理解输入事件，再实现点击。');
  await expect(graph.locator('.relation-lines path[data-selected]')).toHaveCount(1);

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1440, height: 850 });
  await page.screenshot({ path: testInfo.outputPath('relations-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => graph.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('relations-mobile.png'), fullPage: true });

  await page.getByRole('navigation', { name: '主要功能' }).getByRole('button', { name: '页面菜单' }).click();
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  const file = await pending;
  const buffer = await readFile((await file.path())!);
  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件', { exact: true }).setInputFiles({ name: 'relations.json', mimeType: 'application/json', buffer });
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新', exact: true }).click()]);
    await restored.goto('/#relations/code/' + codeId);
    await expect(relationButton(restored, '记录验证', logTitle)).toBeVisible();
    await relationButton(restored, '实现示例', '点击判定').click();
    await expect(restored.getByLabel('补充说明（可选）')).toHaveValue('这是点击判定的脚本示例。');
  } finally { await context.close(); }
});

test('关系多时可逐组查看，未关联资料有空态并可回到原资料', async ({ page }) => {
  await seedRelations(page, 7);
  await page.goto('/#relations/entry/click-entry');
  const graph = relationGraph(page);
  await expect(graph.getByRole('button')).toHaveCount(6);
  await page.getByRole('button', { name: '下一组' }).click();
  await expect(graph.getByRole('button')).toHaveCount(4);
  await expect(graph.getByRole('link', { name: /打开代码版本.*InputManager.cs/ })).toBeVisible();
  await page.goto('/#relations/entry/empty-entry');
  await expect(page.getByRole('heading', { name: '暂无直接关联' })).toBeVisible();
  await expect(graph.getByRole('link')).toHaveCount(1);
  await page.getByRole('link', { name: /返回当前资料/ }).click();
  await expect(page.getByRole('region', { name: '词条详情' }).getByRole('heading', { name: '空白词条', exact: true })).toBeVisible();
});
