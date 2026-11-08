import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const date = '2026-11-05';
const script = 'Assets/' + 'LongDirectoryName'.repeat(9) + '/InputManager.cs';

async function seedResources(page: Page, url = '/#data') {
  await page.addInitScript(({ date }) => {
    if (localStorage.getItem('search-test-seeded')) return;
    localStorage.setItem('search-test-seeded', '1');
    localStorage.setItem('learning-assistant:study-logs', JSON.stringify([
      { id: 'tilemap-log', date, content: '# Day1 素材处理\n\n在 Tilemap 里绘制瓦片。', tags: ['2D关卡'], knowledgePoints: [], duration: 25, createdAt: 1, updatedAt: 1 },
      { id: 'other-log', date: '2026-11-03', content: '# Day2 练习记录', tags: [], knowledgePoints: [], duration: 0, createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('learning-assistant:knowledge', JSON.stringify({
      version: 1,
      entries: [
        { id: 'tilemap-entry', title: '瓦片地图', aliases: ['Tilemap', '网格地图'], category: 'Unity', content: '可以设置自动拼接。', createdAt: 1, updatedAt: 1 },
        { id: 'sprite-entry', title: 'Sprite 切割', aliases: ['sprite slicing'], category: '', content: '', createdAt: 1, updatedAt: 1 },
      ],
      logLinks: [], relations: [],
    }));
  }, { date });
  await page.goto(url);
  return page.evaluate(async (path) => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    return useProjectCodeStore.getState().saveVersion({
      project: { name: 'Whack-a-Mole', repositoryUrl: '', tutorialUrl: '' },
      path, content: 'public class InputManager { }', githubUrl: '', note: 'Tilemap 输入测试',
    }, { kind: 'entry', id: 'tilemap-entry' });
  }, script);
}

test('统一检索分组、筛选并打开日志、词条和脚本版本', async ({ page }, testInfo) => {
  const versionId = await seedResources(page);
  const trigger = page.getByRole('button', { name: '检索资料', exact: true });
  const dialog = page.getByRole('dialog', { name: '检索资料' });
  const query = dialog.getByRole('searchbox', { name: '检索关键词' });
  await trigger.click();
  await expect(query).toBeFocused();
  await query.fill('　ＴＩＬＥＭＡＰ　');
  await expect(dialog.getByRole('status')).toHaveText('3 条匹配结果');
  await expect(dialog.getByRole('region', { name: '学习日志' })).toContainText('在 Tilemap 里绘制瓦片');
  await expect(dialog.getByRole('region', { name: '知识词条' })).toContainText('瓦片地图');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('search-390.png') });
  await dialog.getByRole('button', { name: '代码版本', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('1 条匹配结果');
  await expect(dialog.getByRole('region', { name: '学习日志' })).toHaveCount(0);
  await expect(dialog.getByRole('region', { name: '代码版本' })).toContainText('Tilemap 输入测试');
  await query.fill('inputmanager.cs whack-a-mole');
  await dialog.getByRole('link', { name: script, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('#code/' + versionId + '$'));
  await expect(page.getByRole('heading', { name: script, exact: true })).toBeVisible();

  await trigger.click();
  await dialog.getByRole('button', { name: '全部', exact: true }).click();
  await query.fill('2d关卡');
  await dialog.getByRole('link', { name: /Day1 素材处理/ }).click();
  await expect(page.getByLabel('定位学习日期')).toHaveValue(date);
  await expect(page.getByRole('heading', { name: 'Day1 素材处理' })).toBeVisible();

  await trigger.click();
  await query.fill('网格地图 自动拼接');
  await dialog.getByRole('link', { name: '瓦片地图', exact: true }).click();
  await expect(page).toHaveURL(/#knowledge\/tilemap-entry$/);
  await expect(page.getByRole('heading', { name: '瓦片地图', exact: true })).toBeVisible();
  await trigger.click();
  await query.fill('不存在的资料');
  await expect(dialog.getByRole('status')).toHaveText('没有匹配的资料。');
  await query.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('词条三类关联选项在桌面和窄屏对齐，筛选时保留勾选', async ({ page }, testInfo) => {
  await seedResources(page, '/#knowledge/tilemap-entry');
  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  const form = page.getByRole('form', { name: '词条编辑表单' });
  for (const [title, count] of [['关联学习日志', 0], ['关联其他词条', 0], ['关联代码版本', 1]] as const) {
    await form.getByText(`${title}（${count}）`, { exact: true }).click();
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const title of ['关联学习日志', '关联其他词条', '关联代码版本']) {
      const group = form.getByRole('group', { name: title, exact: true });
      const checkbox = group.getByRole('checkbox').first();
      await expect(checkbox).toBeVisible();
      const layout = await checkbox.evaluate((input) => ({
        checkboxWidth: input.getBoundingClientRect().width,
        textWidth: input.nextElementSibling?.getBoundingClientRect().width ?? 0,
        overflow: input.parentElement!.parentElement!.scrollWidth > input.parentElement!.parentElement!.clientWidth,
      }));
      expect(layout.checkboxWidth).toBeLessThan(24);
      expect(layout.textWidth).toBeGreaterThan(45);
      expect(layout.overflow).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await form.getByRole('region', { name: '关联资料（可选）' }).screenshot({ path: testInfo.outputPath(`references-${width}.png`) });
  }

  const logFilter = form.getByRole('searchbox', { name: '筛选关联学习日志' });
  const log = form.getByRole('checkbox', { name: /Day1 素材处理/ });
  await logFilter.fill('2d关卡');
  await expect(form.getByRole('checkbox', { name: /Day2 练习记录/ })).toHaveCount(0);
  await log.check();
  await logFilter.fill('没有这一条');
  await expect(form.getByText('关联学习日志（1）', { exact: true })).toBeVisible();
  await expect(log).toHaveCount(0);
  await logFilter.fill('');
  await expect(log).toBeChecked();
  const termFilter = form.getByRole('searchbox', { name: '筛选关联其他词条' });
  await termFilter.fill('slicing');
  await termFilter.press('Enter');
  await expect(form).toBeVisible();
  await form.getByRole('checkbox', { name: 'Sprite 切割', exact: true }).check();
  await form.getByRole('searchbox', { name: '筛选关联代码版本' }).fill('inputmanager');
  await expect(form.getByRole('checkbox', { name: /InputManager.cs/ })).toBeChecked();
  await form.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(page.getByRole('region', { name: '相关学习记录' }).getByRole('link', { name: /Day1 素材处理/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '相关词条' }).getByRole('link', { name: 'Sprite 切割' })).toBeVisible();
});

test('目标页已有编辑表单时在新标签打开结果，原草稿保留', async ({ page, context }) => {
  await seedResources(page, '/#knowledge/tilemap-entry');
  await page.getByRole('button', { name: '编辑词条', exact: true }).click();
  const draft = page.getByLabel('词条正文（Markdown）', { exact: true });
  await draft.fill('尚未保存的草稿');
  await page.getByRole('link', { name: '数据管理', exact: true }).click();
  await page.getByRole('button', { name: '检索资料', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '检索资料' });
  await dialog.getByRole('searchbox').fill('slicing');
  const target = dialog.getByRole('link', { name: 'Sprite 切割', exact: true });
  await expect(target).toHaveAttribute('target', '_blank');
  const [newTab] = await Promise.all([context.waitForEvent('page'), target.click()]);
  await expect(newTab.getByRole('heading', { name: 'Sprite 切割', exact: true })).toBeVisible();
  await newTab.close();
  await expect(page).toHaveURL(/#data$/);
  await page.getByRole('link', { name: '知识词条', exact: true }).click();
  await expect(draft).toHaveValue('尚未保存的草稿');
});
