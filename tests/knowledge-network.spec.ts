import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { KnowledgeData } from '../src/types';

const terms = [
  ['ppu', '像素单位', '渲染', ['PPU']],
  ['sprite', '精灵切片', '渲染'],
  ['atlas', '图集', '渲染'],
  ['tilemap', '瓦片地图', '渲染'],
  ['sorting', '排序层', '渲染'],
  ['pointer', '指针输入', '交互'],
  ['input', '输入系统', '交互'],
  ['raycast', '射线检测', '交互'],
  ['collision', '碰撞检测', '交互'],
  ['action', '输入动作', '交互'],
  ['event', '事件', 'C#'],
  ['delegate', '委托', 'C#'],
  ['interface', '接口', 'C#'],
  ['singleton', '单例', ''],
] as const;

const links = [
  ['ppu', 'sprite'], ['sprite', 'atlas'], ['atlas', 'tilemap'], ['tilemap', 'sorting'],
  ['tilemap', 'collision'], ['collision', 'raycast'], ['raycast', 'pointer'], ['pointer', 'input'],
  ['input', 'action'], ['action', 'event'], ['event', 'delegate'], ['delegate', 'interface'],
  ['sprite', 'pointer'], ['collision', 'event'],
] as const;

async function seedNetwork(page: Page) {
  await page.addInitScript(({ terms, links }) => {
    if (localStorage.getItem('network-test-seeded')) return;
    localStorage.setItem('network-test-seeded', '1');
    localStorage.setItem('learning-assistant:study-logs', JSON.stringify([{
      id: 'sprite-log', date: '2026-11-04', content: '# 导入精灵素材', tags: [], knowledgePoints: [], duration: 0, createdAt: 1, updatedAt: 1,
    }]));
    localStorage.setItem('learning-assistant:knowledge', JSON.stringify({
      version: 1,
      entries: terms.map(([id, title, category, aliases]) => ({ id, title, category, aliases: aliases ?? [], content: '', createdAt: 1, updatedAt: 1 })),
      logLinks: [{ id: 'ppu-log', logId: 'sprite-log', entryId: 'ppu', note: '设置导入比例时遇到。' }],
      relations: links.map(([sourceId, targetId], index) => ({
        id: 'term-link-' + index, sourceId, targetId, annotation: index === 0 ? { label: '素材设置', note: '导入同一张精灵图时使用。' } : undefined,
      })),
    }));
  }, { terms, links });
  await page.goto('/');
}

const filterButton = (page: Page) => page.getByRole('button', { name: '图层与筛选', exact: true });
const searchButton = (page: Page) => page.getByRole('button', { name: '搜索节点', exact: true });
const modulePicker = (page: Page) => page.getByRole('group', { name: '模块可见性', exact: true });

async function selectVisibleModules(page: Page, categories: string[]) {
  const picker = modulePicker(page);
  const hideAll = picker.getByRole('button', { name: '全部隐藏', exact: true });
  if (await hideAll.isEnabled()) await hideAll.click();
  for (const category of categories) await picker.getByRole('checkbox', { name: category, exact: true }).check();
}

function cardsFit(graph: Locator, selector = '.network-node') {
  return graph.evaluate((element, cards) => {
    const view = element.getBoundingClientRect();
    return Array.from(element.querySelectorAll(cards)).every((card) => {
      const rect = card.getBoundingClientRect();
      return rect.left >= view.left - 1 && rect.top >= view.top - 1 && rect.right <= view.right + 1 && rect.bottom <= view.bottom + 1;
    });
  }, selector);
}

async function setNetworkScope(page: Page, scope: string) {
  await filterButton(page).click();
  await page.getByRole('combobox', { name: '显示范围', exact: true }).selectOption(scope);
  await filterButton(page).click();
}

test('知识网络同时展示跨分类连线，搜索和编辑可沿图回到原词条', async ({ page }, testInfo) => {
  await seedNetwork(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const nav = page.getByRole('navigation', { name: '主要功能' });
  await nav.getByRole('link', { name: '知识网络', exact: true }).click();
  await expect(page).toHaveURL(/#network$/);
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const layers = page.getByRole('group', { name: '知识网络图层' });
  const details = page.getByRole('complementary', { name: '知识网络详情' });
  await filterButton(page).click();
  await layers.getByRole('button', { name: '学习日志', exact: true }).click();
  await layers.getByRole('button', { name: '代码版本', exact: true }).click();
  await filterButton(page).click();
  await expect(graph.locator('.network-node')).toHaveCount(14);
  await expect(graph.locator('.network-line')).toHaveCount(14);
  await expect(graph.getByRole('button', { name: '单例', exact: true })).toBeVisible();
  await expect(graph).toBeInViewport({ ratio: 1 });
  await expect.poll(() => cardsFit(graph)).toBe(true);
  await expect(details.getByRole('heading', { name: '词条目录（14）' })).toBeVisible();
  await expect(details.getByText('渲染（5）', { exact: true })).toBeVisible();
  await expect(details.getByRole('button', { name: '像素单位', exact: true })).toHaveCount(0);
  await details.getByText('渲染（5）', { exact: true }).click();
  await expect(details.getByRole('button', { name: '像素单位', exact: true })).toBeVisible();
  await details.getByText('渲染（5）', { exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('knowledge-network-desktop.png') });

  await graph.getByRole('button', { name: '碰撞检测', exact: true }).click();
  await expect(graph.locator('g[data-active] .network-line')).toHaveCount(3);
  await expect(details.getByRole('button', { name: '瓦片地图', exact: true })).toBeVisible();
  await expect(details.getByRole('button', { name: '事件', exact: true })).toBeVisible();
  await details.getByRole('button', { name: '事件', exact: true }).click();
  await expect(graph.getByRole('button', { name: '事件', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(graph.locator('.network-line')).toHaveCount(14);

  await searchButton(page).click();
  await page.getByRole('searchbox', { name: '节点关键词' }).fill('ＰＰＵ');
  await expect(graph.locator('.network-node[data-match]')).toHaveText('像素单位');
  await expect(graph.locator('.network-node')).toHaveCount(14);
  await page.locator('#network-node-search').getByRole('button', { name: /^像素单位/ }).click();
  await graph.getByRole('button', { name: '查看 像素单位 与 精灵切片 的关系（素材设置）', exact: true }).click();
  const editor = details.getByRole('form', { name: '编辑关系' });
  await expect(editor.getByLabel('补充说明（可选）')).toHaveValue('导入同一张精灵图时使用。');
  await editor.getByLabel('连线标签').fill('导入比例');
  await editor.getByRole('button', { name: '保存关系' }).click();
  await expect(graph.getByRole('button', { name: '查看 像素单位 与 精灵切片 的关系（导入比例）', exact: true })).toBeVisible();

  await filterButton(page).click();
  await selectVisibleModules(page, ['渲染']);
  await filterButton(page).click();
  await expect(graph.locator('.network-node')).toHaveCount(5);
  await expect(graph.locator('.network-line')).toHaveCount(4);
  await details.getByRole('button', { name: /^像素单位/ }).click();
  await details.getByRole('link', { name: '打开词条', exact: true }).click();
  await expect(page).toHaveURL(/#knowledge\/ppu$/);
  await page.getByRole('link', { name: '在知识网络中查看', exact: true }).click();
  await expect(page).toHaveURL(/#network\/ppu$/);
  await expect(graph.getByRole('button', { name: '像素单位', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await details.getByRole('link', { name: '查看关系', exact: true }).click();
  await expect(page.getByRole('group', { name: '直接关系图' }).getByRole('button', { name: '查看连线 导入比例 · 精灵切片', exact: true })).toBeVisible();
});

test('知识网络可显示原有学习来源并在窄屏缩放', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedNetwork(page);
  await page.evaluate(async () => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const store = useProjectCodeStore.getState();
    const versionId = await store.saveVersion({
      project: { name: '素材练习', repositoryUrl: '', tutorialUrl: '' },
      path: 'Assets/Scripts/Scale.cs', content: 'public class Scale { }', githubUrl: '', note: '',
    }, { kind: 'log', id: 'sprite-log' });
    await store.linkVersion(versionId, { kind: 'entry', id: 'ppu' });
  });
  await page.goto('/#network/ppu');
  await page.reload();
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const layers = page.getByRole('group', { name: '知识网络图层' });
  const logLayer = layers.getByRole('button', { name: '学习日志', exact: true });
  const codeLayer = layers.getByRole('button', { name: '代码版本', exact: true });
  await expect(graph.getByRole('button', { name: '像素单位', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(graph.locator('.network-node')).toHaveCount(16);
  await expect(graph.locator('.network-line')).toHaveCount(17);
  await expect(graph.locator('.network-node[data-kind="log"]')).toContainText('导入精灵素材');
  await expect(graph.locator('.network-node[data-kind="code"]')).toContainText('Scale.cs');
  await page.getByRole('button', { name: '恢复实际大小' }).click();
  await expect.poll(() => cardsFit(graph)).toBe(false);
  await page.getByRole('button', { name: '适应窗口', exact: true }).click();
  await expect.poll(() => cardsFit(graph)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('knowledge-network-mobile.png'), fullPage: true });
  await filterButton(page).click();
  await codeLayer.click();
  await expect(graph.locator('.network-node')).toHaveCount(15);
  await expect(graph.locator('.network-node[data-kind="log"]')).toHaveCount(1);
  await logLayer.click();
  await expect(graph.locator('.network-node')).toHaveCount(14);
  await filterButton(page).click();
  await searchButton(page).click();
  await page.getByRole('searchbox', { name: '节点关键词' }).fill('Assets/Scripts/Scale');
  await page.locator('#network-node-search').getByRole('button', { name: /^Scale\.cs/ }).click();
  await expect(graph.locator('.network-node')).toHaveCount(15);
  const script = graph.locator('.network-node[data-kind="code"]');
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '添加连线', exact: true }).click();
  const details = page.getByRole('complementary', { name: '知识网络详情' });
  await details.getByRole('searchbox', { name: '搜索终点', exact: true }).fill('单例');
  await expect(details.getByRole('combobox', { name: '终点', exact: true }).locator('option')).toHaveCount(2);
  await details.getByRole('combobox', { name: '终点', exact: true }).selectOption({ label: '单例' });
  await details.getByLabel('连线标签（可选）').fill('示例代码');
  await details.getByRole('button', { name: '建立关联' }).click();
  await expect(graph.locator('.network-line')).toHaveCount(16);
  await details.getByRole('button', { name: '查看与 单例 的关系（示例代码）', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await details.getByRole('button', { name: '移除连线' }).click();
  await expect(graph.locator('.network-line')).toHaveCount(15);
  await script.dblclick();
  await expect(page).toHaveURL(/#code\/[^/]+$/);
});

test('图上可以建立、标注和移除连线，双击节点打开对应资料', async ({ page }) => {
  await seedNetwork(page);
  await page.goto('/#network');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const details = page.getByRole('complementary', { name: '知识网络详情' });
  const singleton = graph.getByRole('button', { name: '单例', exact: true });
  await singleton.click();
  await expect(singleton).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '添加连线', exact: true }).click();
  const newLink = details.getByRole('form', { name: '添加连线' });
  await graph.getByRole('button', { name: '接口', exact: true }).click();
  await expect(graph.locator('.network-draft-line')).toHaveCount(1);
  await newLink.getByLabel('连线标签（可选）').fill('实现方式');
  await newLink.getByLabel('补充说明（可选）').fill('在实现中用到了接口。');
  await newLink.getByRole('button', { name: '建立关联' }).click();
  await expect(details.getByRole('status')).toHaveText('连线已建立。');
  await setNetworkScope(page, '1');
  await expect(graph.locator('.network-node')).toHaveCount(2);
  await expect(graph.locator('.network-line')).toHaveCount(1);

  await details.getByRole('button', { name: '查看与 接口 的关系（实现方式）', exact: true }).click();
  const editor = details.getByRole('form', { name: '编辑关系' });
  await expect(editor.getByLabel('补充说明（可选）')).toHaveValue('在实现中用到了接口。');
  await editor.getByLabel('连线标签').fill('设计练习');
  await editor.getByRole('button', { name: '保存关系' }).click();
  await expect(graph.locator('.network-edge-label')).toHaveText('设计练习');
  page.once('dialog', (dialog) => dialog.accept());
  await details.getByRole('button', { name: '移除连线' }).click();
  await expect(details.getByRole('status')).toHaveText('连线已移除。');
  await expect(graph.locator('.network-node')).toHaveCount(1);
  await expect(graph.locator('.network-line')).toHaveCount(0);

  await page.getByRole('button', { name: '添加连线', exact: true }).click();
  await searchButton(page).click();
  await page.getByRole('searchbox', { name: '节点关键词' }).fill('导入精灵素材');
  await page.locator('#network-node-search').getByRole('button', { name: /导入精灵素材/ }).click();
  await expect(newLink.getByRole('combobox', { name: '终点', exact: true })).toHaveValue(JSON.stringify(['log', 'sprite-log']));
  await newLink.getByRole('button', { name: '建立关联' }).click();
  await expect(details.getByRole('status')).toHaveText('连线已建立。');
  await graph.locator('.network-node[data-kind="log"]').dblclick();
  await expect(page).toHaveURL(/#history\/2026-11-04$/);
  await page.goto('/#network');
  await singleton.dblclick();
  await expect(page).toHaveURL(/#knowledge\/singleton$/);
});

test('密集演示能分层聚焦，选中连线可绕开卡片且个人数据独立保存', async ({ context, page }, testInfo) => {
  await seedNetwork(page);
  await page.evaluate(async () => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    await useProjectCodeStore.getState().saveVersion({
      project: { name: '个人项目', repositoryUrl: '', tutorialUrl: '' },
      path: 'Personal.cs', content: 'public class Personal { }', githubUrl: '', note: '',
    }, { kind: 'entry', id: 'ppu' });
  });
  const readResources = () => page.evaluate(async () => {
    const { createBackup } = await import('/src/utils/dataBackup.ts');
    const { knowledge, studyLogs, projectCode } = (await createBackup()).data;
    return { knowledge, studyLogs, projectCode };
  });
  await page.goto('/#network');
  const personalResources = await readResources();
  expect(personalResources.projectCode?.versions).toHaveLength(1);
  const [demo] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('link', { name: '打开知识网络演示', exact: true }).click(),
  ]);
  await demo.setViewportSize({ width: 1440, height: 900 });
  await demo.emulateMedia({ colorScheme: 'dark' });
  await expect(demo).toHaveURL(/\?workspace=knowledge-demo#network$/);
  await expect(demo.getByText('知识网络演示工作区', { exact: true })).toBeVisible();
  const graph = demo.getByRole('group', { name: '知识网络图', exact: true });
  const nodes = graph.locator('button.network-node');
  const lines = graph.locator('.network-line');
  const details = demo.getByRole('complementary', { name: '知识网络详情' });
  await expect(nodes).toHaveCount(136);
  await expect(lines).toHaveCount(340);
  expect(await nodes.evaluateAll((elements: HTMLButtonElement[]) => elements.every((a, index) => elements.slice(index + 1).every((b) =>
    a.offsetLeft + a.offsetWidth <= b.offsetLeft || b.offsetLeft + b.offsetWidth <= a.offsetLeft
    || a.offsetTop + a.offsetHeight <= b.offsetTop || b.offsetTop + b.offsetHeight <= a.offsetTop)))).toBe(true);
  await demo.screenshot({ path: testInfo.outputPath('knowledge-network-demo-overview.png') });

  const hub = graph.getByRole('button', { name: '像素单位', exact: true });
  await hub.click();
  await expect(hub).toHaveAttribute('aria-pressed', 'true');
  await setNetworkScope(demo, '1');
  const oneHopCount = await nodes.count();
  expect(oneHopCount).toBeGreaterThan(2);
  const typeColors = await graph.locator('.network-node[data-active]').evaluateAll((elements) =>
    Object.fromEntries(elements.map((element) => [element.getAttribute('data-kind'), getComputedStyle(element).borderInlineStartColor])));
  expect(Object.keys(typeColors).sort()).toEqual(['code', 'entry', 'log']);
  expect(new Set(Object.values(typeColors)).size).toBe(3);
  await demo.screenshot({ path: testInfo.outputPath('knowledge-network-demo-one-hop.png') });
  await setNetworkScope(demo, '2');
  expect(await nodes.count()).toBeGreaterThan(oneHopCount);
  expect(await nodes.count()).toBeLessThan(136);
  await setNetworkScope(demo, '0');
  await expect(nodes).toHaveCount(136);

  await details.getByRole('button', { name: '查看与 碰撞检测 的关系（练习线索）', exact: true }).click();
  const selectedPath = graph.locator('g[data-active] .network-line');
  await expect(selectedPath).toHaveCount(1);
  expect(await selectedPath.evaluate((path: SVGPathElement) => {
    const cards = Array.from(path.closest('.network-board')!.querySelectorAll<HTMLButtonElement>('.network-node:not([data-active])'));
    const length = path.getTotalLength();
    for (let offset = 0; offset <= length; offset += 2) {
      const { x, y } = path.getPointAtLength(offset);
      if (cards.some((card) => x >= card.offsetLeft && x <= card.offsetLeft + card.offsetWidth
        && y >= card.offsetTop && y <= card.offsetTop + card.offsetHeight)) return false;
    }
    return true;
  })).toBe(true);
  await setNetworkScope(demo, '1');
  await details.getByRole('button', { name: '查看与 碰撞检测 的关系（练习线索）', exact: true }).click();
  const editor = details.getByRole('form', { name: '编辑关系' });
  await editor.getByLabel('连线标签').fill('压力验证');
  await editor.getByRole('button', { name: '保存关系' }).click();
  await expect(graph.locator('.network-edge-label')).toHaveText('压力验证');
  await demo.screenshot({ path: testInfo.outputPath('knowledge-network-demo-focused.png') });
  await hub.dblclick();
  await expect(demo).toHaveURL(/\?workspace=knowledge-demo#knowledge\/demo-entry-0-0$/);
  await demo.reload();
  await demo.getByRole('link', { name: '在知识网络中查看', exact: true }).click();
  await expect(details.getByRole('button', { name: '查看与 碰撞检测 的关系（压力验证）', exact: true })).toBeVisible();
  await demo.getByTitle('开发者工具 (可拖动)').click();
  demo.once('dialog', (dialog) => dialog.accept());
  await demo.getByRole('button', { name: '恢复内置演示数据', exact: true }).click();
  await expect(details.getByRole('button', { name: '查看与 碰撞检测 的关系（练习线索）', exact: true })).toBeVisible();
  await demo.getByRole('link', { name: '返回个人知识网络', exact: true }).click();
  await expect(demo).toHaveURL(/\/#network$/);
  await expect(demo.getByText('知识网络演示工作区', { exact: true })).toHaveCount(0);
  await page.reload();
  expect(await readResources()).toEqual(personalResources);
});

test('全屏保留画布操作，拖动节点可复位，空白处可新建同分类词条', async ({ page }, testInfo) => {
  await seedNetwork(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#network');
  const supportsKeyboardLock = await page.evaluate(() => {
    const keyboard = (navigator as Navigator & {
      keyboard?: { lock: (codes: string[]) => Promise<void>; unlock: () => void };
    }).keyboard;
    if (!keyboard?.lock || !keyboard.unlock) return false;
    const lock = keyboard.lock.bind(keyboard);
    const unlock = keyboard.unlock.bind(keyboard);
    keyboard.lock = async (codes) => {
      await lock(codes);
      document.documentElement.dataset.testLockedKeys = codes.join(' ');
    };
    keyboard.unlock = () => {
      unlock();
      delete document.documentElement.dataset.testLockedKeys;
    };
    return true;
  });
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const height = await graph.evaluate((element) => element.clientHeight);
  await page.getByRole('button', { name: '全屏画布', exact: true }).click();
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();
  await expect.poll(() => graph.evaluate((element) => element.clientHeight)).toBeGreaterThan(height + 100);

  const ppu = graph.getByRole('button', { name: '像素单位', exact: true });
  if (testInfo.project.use.channel === 'msedge') expect(supportsKeyboardLock).toBe(true);
  if (supportsKeyboardLock) {
    await expect(page.locator('html')).not.toHaveAttribute('data-test-locked-keys', 'Escape');
    await ppu.click({ button: 'right' });
    await page.getByRole('menuitem', { name: '编辑词条' }).click();
    const editor = page.getByRole('dialog', { name: '在画布中编辑词条' });
    await expect(page.locator('html')).toHaveAttribute('data-test-locked-keys', 'Escape');
    await editor.getByLabel('词条名称（必填）').fill('取消编辑时舍弃的名称');
    await page.keyboard.down('Escape');
    await page.keyboard.down('Escape');
    await expect(editor).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-test-locked-keys', 'Escape');
    expect(await page.evaluate(() => document.fullscreenElement?.classList.contains('network-workspace'))).toBe(true);
    await page.keyboard.up('Escape');
    await expect(editor).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-test-locked-keys', 'Escape');
    await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.fullscreenElement?.classList.contains('network-workspace'))).toBe(true);
    await expect(ppu).toBeVisible();
  }
  const position = () => ppu.evaluate((element: HTMLButtonElement) => [element.offsetLeft, element.offsetTop]);
  const originalPosition = await position();
  const originalLines = await graph.locator('.network-line').evaluateAll((lines) => lines.map((line) => line.getAttribute('d')));
  const box = (await ppu.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 64, box.y + box.height / 2 + 54, { steps: 8 });
  await page.mouse.up();
  expect(await position()).not.toEqual(originalPosition);
  expect(await graph.locator('.network-line').evaluateAll((lines) => lines.map((line) => line.getAttribute('d')))).not.toEqual(originalLines);
  await expect(ppu).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '重置节点位置' }).click();
  expect(await position()).toEqual(originalPosition);
  await page.screenshot({ path: testInfo.outputPath('knowledge-network-fullscreen.png') });

  await filterButton(page).click();
  await selectVisibleModules(page, ['渲染']);
  await filterButton(page).click();
  await graph.click({ button: 'right', position: { x: 12, y: 12 } });
  await page.getByRole('menuitem', { name: '新建词条' }).click();
  const dialog = page.getByRole('dialog', { name: '在画布中新建词条' });
  await expect(dialog.getByLabel('分类（可选）')).toHaveValue('渲染');
  await dialog.getByLabel('词条名称（必填）').fill('调色板');
  await dialog.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(graph.getByRole('button', { name: '调色板', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(graph.locator('.network-node[data-kind="entry"]')).toHaveCount(6);
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await expect(page.getByRole('button', { name: '全屏画布', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '全屏画布', exact: true }).click();
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();
  await graph.getByRole('button', { name: '调色板', exact: true }).dblclick();
  await expect(page.getByRole('region', { name: '词条详情' }).getByRole('heading', { name: '调色板', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test('模块可见性可对照两个到四个模块，隐藏整组连线并保留返回视角', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/?workspace=knowledge-demo#network');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const summary = page.getByRole('region', { name: '跨模块关联结果' });
  const details = page.getByRole('complementary', { name: '知识网络详情' });
  const crossOnly = page.getByRole('checkbox', { name: '只看跨模块关联', exact: true });
  const picker = modulePicker(page);
  const lines = graph.locator('.network-line');
  await filterButton(page).click();
  await selectVisibleModules(page, ['2D 渲染', '物理与碰撞']);
  await expect(summary.getByRole('heading', { name: '直接跨模块连线（3）' })).toBeVisible();
  await expect(summary.getByRole('heading', { name: '共同关联资料（2）' })).toBeVisible();
  await expect.poll(() => lines.count()).toBeGreaterThan(9);
  await crossOnly.check();
  await filterButton(page).click();
  await expect(lines).toHaveCount(9);
  await expect(graph.locator('.network-node[data-kind="entry"]')).toHaveCount(24);
  await expect(graph.locator('.network-node[data-kind="log"]')).toHaveCount(1);
  await expect(graph.locator('.network-node[data-kind="code"]')).toHaveCount(1);
  await expect(graph.getByRole('button', { name: '指针输入', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('knowledge-network-module-comparison.png') });

  await summary.getByRole('button', { name: /^像素单位 ↔ 碰撞检测/ }).click();
  await expect(graph.locator('g[data-active] .network-line')).toHaveCount(1);
  await expect(details.getByLabel('连线标签', { exact: true })).toHaveValue('练习线索');
  await details.getByRole('button', { name: '← 跨模块关联', exact: true }).click();
  await summary.getByRole('button', { name: /2D 渲染练习 1/ }).click();
  await expect(graph.locator('.network-node[data-kind="log"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '放大知识网络' }).click();
  const zoom = page.getByRole('button', { name: '恢复实际大小' });
  const previousZoom = await zoom.textContent();
  const transform = await graph.locator('.network-board').evaluate((element: HTMLElement) => element.style.transform);
  await details.getByRole('link', { name: '打开原资料' }).click();
  await expect(page).toHaveURL(/\?workspace=knowledge-demo#history\/2026-10-01$/);
  await page.goBack();
  await expect(graph.locator('.network-node[data-kind="log"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(zoom).toHaveText(previousZoom!);
  expect(await graph.locator('.network-board').evaluate((element: HTMLElement) => element.style.transform)).toBe(transform);
  await expect(lines).toHaveCount(9);
  await details.getByRole('button', { name: '← 跨模块关联', exact: true }).click();

  await filterButton(page).click();
  await expect(crossOnly).toBeChecked();
  const logLayer = page.getByRole('group', { name: '知识网络图层' }).getByRole('button', { name: '学习日志', exact: true });
  await logLayer.click();
  await expect(summary.getByRole('heading', { name: '共同关联资料（1）' })).toBeVisible();
  await expect(lines).toHaveCount(5);
  await logLayer.click();
  await picker.getByRole('checkbox', { name: '输入与交互', exact: true }).check();
  await expect(summary.getByRole('heading', { name: '直接跨模块连线（14）' })).toBeVisible();
  await expect(lines).toHaveCount(20);
  await picker.getByRole('checkbox', { name: '场景与资源', exact: true }).check();
  await expect(summary.getByRole('heading', { name: '直接跨模块连线（33）' })).toBeVisible();
  await expect(graph.locator('.network-node[data-kind="entry"]')).toHaveCount(48);
  await expect(lines).toHaveCount(39);
  await expect(summary.getByRole('heading', { name: '共同关联资料（2）' })).toBeVisible();
  await expect(summary.getByText('输入与交互 ↔ 物理与碰撞（8）', { exact: true })).toBeVisible();
  await filterButton(page).click();
  await page.screenshot({ path: testInfo.outputPath('knowledge-network-four-modules.png') });
  await graph.locator('[data-network-module="2D 渲染"]').click({ button: 'right', position: { x: 5, y: 5 } });
  await page.getByRole('menuitem', { name: '隐藏此模块', exact: true }).click();
  await expect(graph.locator('[data-network-module="2D 渲染"]')).toHaveCount(0);
  await expect(graph.getByRole('button', { name: '像素单位', exact: true })).toHaveCount(0);
  await expect(lines).toHaveCount(16);
  await expect(summary.getByRole('heading', { name: '共同关联资料（0）' })).toBeVisible();

  await graph.locator('[data-network-module="物理与碰撞"]').click({ button: 'right', position: { x: 5, y: 5 } });
  await page.getByRole('menuitem', { name: '仅显示此模块', exact: true }).click();
  await expect(graph.locator('.network-node[data-kind="entry"]')).toHaveCount(12);
  await expect(lines).toHaveCount(0);
  await filterButton(page).click();
  await selectVisibleModules(page, ['场景与资源', '调试与性能']);
  await filterButton(page).click();
  await expect(summary.getByText('当前可见模块之间暂无直接连线。', { exact: true })).toBeVisible();
  await expect(lines).toHaveCount(0);
  await expect(graph.locator('.network-node[data-kind="entry"]')).toHaveCount(24);
  await filterButton(page).click();
  await selectVisibleModules(page, []);
  await expect(graph.locator('.network-node')).toHaveCount(0);
  await picker.getByRole('button', { name: '显示全部', exact: true }).click();
  await expect(graph.locator('.network-node[data-kind="entry"]')).toHaveCount(96);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(picker).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('旧演示刷新后只补齐两条样例关联，已有编辑与后续移除得到保留', async ({ page }) => {
  await page.goto('/?workspace=knowledge-demo#network');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const lines = graph.locator('.network-line');
  await expect(lines).toHaveCount(340);
  await page.evaluate(async () => {
    const { STORAGE_KEYS } = await import('/src/utils/storage.ts');
    const { updateProjectCode } = await import('/src/utils/projectCodeStorage.ts');
    const knowledge = JSON.parse(localStorage.getItem(STORAGE_KEYS.KNOWLEDGE)!) as KnowledgeData;
    knowledge.logLinks = knowledge.logLinks.filter(({ id }) => id !== 'demo-shared-sprite-collision-log');
    const entry = knowledge.entries.find(({ id }) => id === 'demo-entry-3-0')!;
    entry.content = '演示里的原有修改';
    entry.codeVersionIds = ['demo-code-3-0'];
    entry.codeAnnotations = [{ versionId: 'demo-code-3-0', annotation: { label: '原有标注', note: '保留原说明' } }];
    localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(knowledge));
    await updateProjectCode((data) => ({ ...data, links: data.links.filter(({ versionId, target }) =>
      versionId !== 'demo-code-0-0' || target.kind !== 'entry' || target.id !== 'demo-entry-3-0') }));
    localStorage.setItem('learning-assistant-demo:knowledge-demo-seeded', '1');
  });
  await page.reload();
  await expect(lines).toHaveCount(340);
  const restored = await page.evaluate(async () => {
    const { STORAGE_KEYS } = await import('/src/utils/storage.ts');
    const knowledge = JSON.parse(localStorage.getItem(STORAGE_KEYS.KNOWLEDGE)!) as KnowledgeData;
    return { entry: knowledge.entries.find(({ id }) => id === 'demo-entry-3-0'),
      sharedLogs: knowledge.logLinks.filter(({ id }) => id === 'demo-shared-sprite-collision-log').length,
      version: localStorage.getItem('learning-assistant-demo:knowledge-demo-seeded') };
  });
  expect(restored.entry?.content).toBe('演示里的原有修改');
  expect(restored.entry?.codeVersionIds).toEqual(['demo-code-3-0', 'demo-code-0-0']);
  expect(restored.entry?.codeAnnotations).toEqual([{ versionId: 'demo-code-3-0', annotation: { label: '原有标注', note: '保留原说明' } }]);
  expect(restored.sharedLogs).toBe(1);
  expect(restored.version).toBe('2');
  await page.evaluate(async () => {
    const { STORAGE_KEYS } = await import('/src/utils/storage.ts');
    const knowledge = JSON.parse(localStorage.getItem(STORAGE_KEYS.KNOWLEDGE)!) as KnowledgeData;
    knowledge.logLinks = knowledge.logLinks.filter(({ id }) => id !== 'demo-shared-sprite-collision-log');
    localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(knowledge));
  });
  await page.reload();
  await expect(lines).toHaveCount(339);
});

test('普通返回保留筛选、聚焦、平移与手动位置，资料回链可重新定位同一个词条', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedNetwork(page);
  await page.goto('/#network/ppu');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const ppu = graph.getByRole('button', { name: '像素单位', exact: true });
  const sprite = graph.getByRole('button', { name: '精灵切片', exact: true });
  const view = () => graph.evaluate((element) => ({
    transform: element.querySelector<HTMLElement>('.network-board')!.style.transform,
    positions: Array.from(element.querySelectorAll<HTMLElement>('.network-node')).map((node) => [node.style.left, node.style.top]),
  }));
  await expect(ppu).toHaveAttribute('aria-pressed', 'true');
  await filterButton(page).click();
  const logLayer = page.getByRole('group', { name: '知识网络图层' }).getByRole('button', { name: '学习日志', exact: true });
  await logLayer.click();
  await selectVisibleModules(page, ['渲染']);
  await filterButton(page).click();
  await sprite.click();
  await expect(sprite).toHaveAttribute('aria-pressed', 'true');
  await setNetworkScope(page, '2');
  await expect(graph.locator('.network-node')).toHaveCount(4);
  await page.getByRole('button', { name: '放大知识网络' }).click();
  const zoom = page.getByRole('button', { name: '恢复实际大小' });
  await expect(zoom).toHaveText('125%');
  const box = (await sprite.boundingBox())!;
  const area = (await graph.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 28, box.y + box.height / 2 + 18, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '重置节点位置' })).toBeEnabled();
  await page.mouse.move(area.x + 10, area.y + 10);
  await page.mouse.down();
  await page.mouse.move(area.x + 70, area.y + 35, { steps: 6 });
  await page.mouse.up();
  const previous = await view();

  await ppu.press('Enter');
  await expect(page).toHaveURL(/#knowledge\/ppu$/);
  await page.goBack();
  await expect(page).toHaveURL(/#network\/ppu$/);
  await expect(sprite).toHaveAttribute('aria-pressed', 'true');
  await expect(zoom).toHaveText('125%');
  expect(await view()).toEqual(previous);
  await filterButton(page).click();
  await expect(logLayer).toHaveAttribute('aria-pressed', 'false');
  await expect(modulePicker(page).getByRole('checkbox', { name: '渲染', exact: true })).toBeChecked();
  await expect(modulePicker(page).getByRole('checkbox', { name: '交互', exact: true })).not.toBeChecked();
  await expect(page.getByRole('combobox', { name: '显示范围', exact: true })).toHaveValue('2');
  await filterButton(page).click();

  await ppu.press('Enter');
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '知识网络', exact: true }).click();
  await expect(page).toHaveURL(/#network$/);
  await expect(sprite).toHaveAttribute('aria-pressed', 'true');
  expect(await view()).toEqual(previous);
  await ppu.press('Enter');
  await page.getByRole('link', { name: '在知识网络中查看', exact: true }).click();
  await expect(page).toHaveURL(/#network\/ppu$/);
  await expect(ppu).toHaveAttribute('aria-pressed', 'true');
  await expect(zoom).toHaveText('125%');
  await expect(page.getByRole('button', { name: '重置节点位置' })).toBeEnabled();
});

test('空白处可平移，Ctrl 滚轮围绕指针缩放，节点可拖出原布局', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedNetwork(page);
  await page.goto('/#network/ppu');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const board = graph.locator('.network-board');
  const card = graph.getByRole('button', { name: '碰撞检测', exact: true });
  await expect(card).toBeVisible();
  await expect.poll(() => cardsFit(graph)).toBe(true);
  const area = (await graph.boundingBox())!;
  const beforePan = (await board.boundingBox())!;
  const pan = async (dx: number, dy: number) => {
    await page.mouse.move(area.x + 10, area.y + 10);
    await page.mouse.down();
    await page.mouse.move(area.x + 10 + dx, area.y + 10 + dy, { steps: 8 });
    await page.mouse.up();
  };
  await pan(160, 32);
  const afterPan = (await board.boundingBox())!;
  expect(afterPan.x - beforePan.x).toBeCloseTo(160, 0);
  expect(afterPan.y - beforePan.y).toBeCloseTo(32, 0);

  await page.evaluate(() => {
    document.addEventListener('wheel', (event) => {
      document.documentElement.dataset.testWheel = `${event.ctrlKey}:${event.defaultPrevented}`;
    });
  });
  const beforeZoom = (await card.boundingBox())!;
  const anchor = { x: beforeZoom.x + beforeZoom.width / 2, y: beforeZoom.y + beforeZoom.height / 2 };
  const wheel = async (deltaY: number) => {
    await page.keyboard.down('Control');
    try { await page.mouse.wheel(0, deltaY); }
    finally { await page.keyboard.up('Control'); }
  };
  await page.mouse.move(anchor.x, anchor.y);
  await wheel(-120);
  await expect.poll(async () => (await card.boundingBox())!.width).toBeGreaterThan(beforeZoom.width);
  const afterZoom = (await card.boundingBox())!;
  expect(afterZoom.x + afterZoom.width / 2).toBeCloseTo(anchor.x, 0);
  expect(afterZoom.y + afterZoom.height / 2).toBeCloseTo(anchor.y, 0);
  await expect(page.locator('html')).toHaveAttribute('data-test-wheel', 'true:true');
  await wheel(120);
  await expect.poll(async () => Math.abs((await card.boundingBox())!.width - beforeZoom.width)).toBeLessThan(1);
  expect(await graph.evaluate((element) => ({
    plainWheel: element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })),
    outsideCtrlWheel: element.parentElement!.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: 120 })),
  }))).toEqual({ plainWheel: true, outsideCtrlWheel: true });

  const originalPosition = await card.evaluate((element: HTMLButtonElement) => element.offsetLeft);
  await page.mouse.move(anchor.x, anchor.y);
  await page.mouse.down();
  await page.mouse.move(area.x + 90, anchor.y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => card.evaluate((element: HTMLButtonElement) => element.offsetLeft)).toBeLessThan(0);
  const viewBox = (await graph.locator('.network-lines').getAttribute('viewBox'))!;
  expect(Number(viewBox.split(' ')[0])).toBeLessThan(0);
  await page.getByRole('button', { name: '适应窗口' }).click();
  await expect.poll(() => cardsFit(graph)).toBe(true);
  expect(await card.evaluate((element: HTMLButtonElement) => element.offsetLeft)).toBeLessThan(0);
  await page.getByRole('button', { name: '重置节点位置' }).click();
  expect(await card.evaluate((element: HTMLButtonElement) => element.offsetLeft)).toBe(originalPosition);

  await pan(500, 0);
  const selectedCard = '.network-node[aria-pressed="true"]';
  await expect.poll(() => cardsFit(graph, selectedCard)).toBe(false);
  await searchButton(page).click();
  await page.getByRole('searchbox', { name: '节点关键词' }).fill('PPU');
  await page.locator('#network-node-search').getByRole('button', { name: /^像素单位/ }).click();
  await expect.poll(() => cardsFit(graph, selectedCard)).toBe(true);
});

function canvasPositions(graph: Locator) {
  return graph.locator('.network-node, .network-group').evaluateAll((items) => Object.fromEntries(
    (items as HTMLElement[]).map((item) => [
      item.dataset.networkEntry ?? item.dataset.networkModule ?? (item.dataset.networkLayer ? `layer:${item.dataset.networkLayer}` : item.textContent),
      { x: parseFloat(item.style.left), y: parseFloat(item.style.top) },
    ]),
  ));
}

async function dragBy(page: Page, locator: Locator, dx: number, dy: number) {
  const { x, y, width, height } = (await locator.boundingBox())!;
  await page.mouse.move(x + width / 2, y + height / 2);
  await page.mouse.down();
  await page.mouse.move(x + width / 2 + dx, y + height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}

function savedKnowledge(page: Page): Promise<KnowledgeData> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:knowledge')!));
}

test('整组拖动带动模块成员和连线，拖动与复位可按步撤销和重做', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedNetwork(page);
  await page.goto('/#network');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const header = graph.getByRole('button', { name: '管理模块 渲染', exact: true });
  await expect.poll(() => cardsFit(graph)).toBe(true);
  const before = await canvasPositions(graph);
  const linesBefore = await graph.locator('.network-line').evaluateAll((lines) => lines.map((line) => line.getAttribute('d')));

  await dragBy(page, header, 38, 24);
  const undo = page.getByRole('button', { name: '撤销画布操作' });
  const redo = page.getByRole('button', { name: '重做画布操作' });
  await expect(undo).toBeEnabled();
  const moved = await canvasPositions(graph);
  const dx = moved['渲染'].x - before['渲染'].x;
  const dy = moved['渲染'].y - before['渲染'].y;
  expect(dx).toBeGreaterThan(0);
  expect(dy).toBeGreaterThan(0);
  for (const [id, , category] of terms) {
    expect(moved[id].x - before[id].x).toBeCloseTo(category === '渲染' ? dx : 0, 5);
    expect(moved[id].y - before[id].y).toBeCloseTo(category === '渲染' ? dy : 0, 5);
  }
  expect(await graph.locator('.network-line').evaluateAll((lines) => lines.map((line) => line.getAttribute('d')))).not.toEqual(linesBefore);

  await page.keyboard.press('Control+z');
  await expect(undo).toBeDisabled();
  expect(await canvasPositions(graph)).toEqual(before);
  await redo.click();
  expect(await canvasPositions(graph)).toEqual(moved);
  await page.getByRole('button', { name: '重置节点位置' }).click();
  expect(await canvasPositions(graph)).toEqual(before);
  await undo.click();
  expect(await canvasPositions(graph)).toEqual(moved);
  await page.keyboard.press('Control+Shift+z');
  expect(await canvasPositions(graph)).toEqual(before);
});

test('Shift 多选和框选可共同移动节点，并批量分类与撤销', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedNetwork(page);
  await page.goto('/#network');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const sidebar = page.getByRole('complementary', { name: '知识网络详情' });
  const sprite = graph.getByRole('button', { name: '精灵切片', exact: true });
  const pointer = graph.getByRole('button', { name: '指针输入', exact: true });
  const singleton = graph.getByRole('button', { name: '单例', exact: true });
  await sprite.click({ modifiers: ['Shift'] });
  await pointer.click({ modifiers: ['Shift'] });
  await expect(sidebar.getByRole('heading', { name: '已选 2 个节点' })).toBeVisible();

  const box = (await singleton.boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x - 4, box.y - 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 4, box.y + box.height + 4, { steps: 8 });
  await expect(graph.locator('.network-selection-box')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(sidebar.getByRole('heading', { name: '已选 3 个节点' })).toBeVisible();
  await expect(singleton).toHaveAttribute('aria-pressed', 'true');

  const before = await canvasPositions(graph);
  await dragBy(page, sprite, 34, 21);
  const moved = await canvasPositions(graph);
  const dx = moved.sprite.x - before.sprite.x;
  const dy = moved.sprite.y - before.sprite.y;
  expect(dx).toBeGreaterThan(0);
  for (const id of ['pointer', 'singleton']) {
    expect(moved[id].x - before[id].x).toBeCloseTo(dx, 5);
    expect(moved[id].y - before[id].y).toBeCloseTo(dy, 5);
  }
  expect(moved.ppu).toEqual(before.ppu);
  expect(moved['渲染']).toEqual(before['渲染']);
  await page.keyboard.press('Control+z');
  expect(await canvasPositions(graph)).toEqual(before);
  await singleton.click({ modifiers: ['Shift'] });
  await expect(singleton).toHaveAttribute('aria-pressed', 'false');

  await sidebar.getByRole('button', { name: '批量改分类（2 个词条）' }).click();
  const dialog = page.getByRole('dialog', { name: '批量改分类' });
  await dialog.getByLabel('目标分类').fill('输入与素材');
  await page.screenshot({ path: testInfo.outputPath('network-category-editor.png') });
  await dialog.getByRole('button', { name: '保存分类' }).click();
  await expect(graph.getByRole('button', { name: '管理模块 输入与素材' })).toBeVisible();
  const saved = (await savedKnowledge(page)).entries;
  expect(saved.filter((entry) => entry.category === '输入与素材').map(({ id }) => id)).toEqual(['sprite', 'pointer']);
  await page.getByRole('button', { name: '撤销画布操作' }).click();
  expect((await savedKnowledge(page)).entries.map(({ category }) => category)).toEqual(terms.map(([, , category]) => category));
  await expect(page.getByRole('button', { name: '撤销画布操作' })).toBeDisabled();
});

test('模块菜单可整理成员、重命名与合并分类，撤销时保留关系', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedNetwork(page);
  await page.goto('/#network');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const menu = page.getByRole('menu', { name: '画布操作' });
  const header = graph.getByRole('button', { name: '管理模块 渲染', exact: true });
  const before = await savedKnowledge(page);
  await header.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '整理成员' }).click();
  const members = page.getByRole('dialog', { name: '整理模块成员' });
  await members.getByRole('button', { name: '清空选择' }).click();
  await members.getByRole('searchbox', { name: '筛选选择要移动的词条' }).fill('PPU');
  await members.getByRole('checkbox', { name: '像素单位' }).check();
  await members.getByLabel('目标分类').fill('交互');
  await members.getByRole('button', { name: '保存分类' }).click();
  expect((await savedKnowledge(page)).entries.find(({ id }) => id === 'ppu')?.category).toBe('交互');
  expect((await savedKnowledge(page)).entries.find(({ id }) => id === 'sprite')?.category).toBe('渲染');
  await page.keyboard.press('Control+z');

  await header.click();
  await menu.getByRole('menuitem', { name: '重命名分类' }).click();
  const rename = page.getByRole('dialog', { name: '重命名分类' });
  await rename.getByLabel('目标分类').fill('交互');
  await expect(rename.getByText('将 5 个词条合并到「交互」。', { exact: true })).toBeVisible();
  await rename.getByRole('button', { name: '保存分类' }).click();
  await expect(header).toHaveCount(0);
  expect((await savedKnowledge(page)).entries.filter(({ category }) => category === '交互')).toHaveLength(10);
  await page.keyboard.press('Control+z');
  await expect(header).toBeVisible();
  const restored = await savedKnowledge(page);
  expect(restored.entries.map(({ category }) => category)).toEqual(before.entries.map(({ category }) => category));
  expect(restored.relations).toEqual(before.relations);
  expect(restored.logLinks).toEqual(before.logLinks);
  await page.keyboard.press('Control+y');
  await expect(header).toHaveCount(0);
});

test('图内编辑保留视角，可撤销词条内容及关联并保护其他编辑', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedNetwork(page);
  const versionId = await page.evaluate(async () => {
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const id = await useProjectCodeStore.getState().saveVersion({
      project: { name: '素材练习', repositoryUrl: '', tutorialUrl: '' },
      path: 'Assets/Scripts/Scale.cs', content: 'public class Scale { }', githubUrl: '', note: '',
    });
    useKnowledgeStore.getState().setEntryCodeLinked('ppu', id, true, { label: '计算比例', note: '对照世界单位换算。' });
    return id;
  });
  await page.goto('/#network/ppu');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const board = graph.locator('.network-board');
  const ppu = graph.getByRole('button', { name: '像素单位', exact: true });
  await expect(ppu).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '放大知识网络' }).click();
  const view = await board.evaluate((element: HTMLElement) => element.style.transform);
  const before = await savedKnowledge(page);
  await ppu.click({ button: 'right' });
  await page.getByRole('menuitem', { name: '编辑词条' }).click();
  const dialog = page.getByRole('dialog', { name: '在画布中编辑词条' });
  await dialog.getByLabel('词条名称（必填）').fill('像素单位与场景比例');
  await dialog.getByLabel('词条正文（Markdown）').fill('## 实验\n\n16 个像素对应 1 个世界单位。');
  await dialog.getByText('关联学习日志（1）', { exact: true }).click();
  await dialog.getByRole('checkbox', { name: /导入精灵素材/ }).uncheck();
  await dialog.getByText('关联其他词条（1）', { exact: true }).click();
  await dialog.getByRole('checkbox', { name: '精灵切片', exact: true }).uncheck();
  await dialog.getByRole('checkbox', { name: '瓦片地图', exact: true }).check();
  await dialog.getByText('关联代码版本（1）', { exact: true }).click();
  await dialog.getByRole('checkbox', { name: /Scale\.cs/ }).uncheck();
  await dialog.getByRole('button', { name: '保存词条', exact: true }).click();
  await expect(page).toHaveURL(/#network\/ppu$/);
  const edited = graph.getByRole('button', { name: '像素单位与场景比例', exact: true });
  await expect(edited).toHaveAttribute('aria-pressed', 'true');
  expect(await board.evaluate((element: HTMLElement) => element.style.transform)).toBe(view);
  const changed = await savedKnowledge(page);
  expect(changed.logLinks).toEqual([]);
  expect(changed.relations).toContainEqual(expect.objectContaining({ sourceId: 'ppu', targetId: 'tilemap' }));
  expect(changed.entries.find(({ id }) => id === 'ppu')?.codeVersionIds).toEqual([]);

  const editOutsideCanvas = (id: string, content: string) => page.evaluate(async ({ id, content }) => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const store = useKnowledgeStore.getState();
    const entry = store.entries.find((item) => item.id === id)!;
    store.saveEntry({ ...entry, content }, { id });
  }, { id, content });
  await editOutsideCanvas('pointer', '另一份词条的新内容');
  await page.keyboard.press('Control+z');
  await expect(ppu).toHaveAttribute('aria-pressed', 'true');
  const restored = await savedKnowledge(page);
  expect(restored.logLinks).toEqual(before.logLinks);
  expect(restored.relations).toEqual(expect.arrayContaining(before.relations));
  expect(restored.relations).toHaveLength(before.relations.length);
  expect(restored.entries.find(({ id }) => id === 'ppu')?.content).toBe('');
  expect(restored.entries.find(({ id }) => id === 'ppu')?.codeAnnotations).toEqual([
    { versionId, annotation: { label: '计算比例', note: '对照世界单位换算。' } },
  ]);
  expect(restored.entries.find(({ id }) => id === 'pointer')?.content).toBe('另一份词条的新内容');
  await page.getByRole('button', { name: '重做画布操作' }).click();
  await expect(edited).toBeVisible();
  await editOutsideCanvas('ppu', '在另一页面补充的内容');
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('alert').filter({ hasText: '词条或关联已有其他修改' })).toBeVisible();
  expect((await savedKnowledge(page)).entries.find(({ id }) => id === 'ppu')?.content).toBe('在另一页面补充的内容');
});

test('日志与代码分组可整组移动、撤销和隐藏，图层恢复后沿用偏移', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?workspace=knowledge-demo#network');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const lines = graph.locator('.network-line');
  const layerControls = page.getByRole('group', { name: '知识网络图层' });
  await filterButton(page).click();
  await selectVisibleModules(page, ['2D 渲染', '物理与碰撞']);
  await page.getByRole('checkbox', { name: '只看跨模块关联', exact: true }).check();
  await filterButton(page).click();
  await expect(lines).toHaveCount(9);
  await expect.poll(() => cardsFit(graph)).toBe(true);

  const before = await canvasPositions(graph);
  for (const [kind, name, dx, dy] of [['log', '学习日志', 21, 25], ['code', '代码版本', -15, 20]] as const) {
    const header = graph.getByRole('button', { name: `管理模块 ${name}`, exact: true });
    const card = graph.locator(`.network-node[data-kind="${kind}"]`);
    const cardKey = (await card.textContent())!;
    const original = await canvasPositions(graph);
    const originalLines = await lines.evaluateAll((items) => items.map((line) => line.getAttribute('d')));
    await dragBy(page, header, dx, dy);
    const moved = await canvasPositions(graph);
    const panelKey = `layer:${kind}`;
    const movedX = moved[panelKey].x - original[panelKey].x;
    const movedY = moved[panelKey].y - original[panelKey].y;
    expect(Math.sign(movedX)).toBe(Math.sign(dx));
    expect(Math.sign(movedY)).toBe(Math.sign(dy));
    expect(moved[cardKey].x - original[cardKey].x).toBeCloseTo(movedX, 4);
    expect(moved[cardKey].y - original[cardKey].y).toBeCloseTo(movedY, 4);
    expect(moved['2D 渲染']).toEqual(before['2D 渲染']);
    expect(await lines.evaluateAll((items) => items.map((line) => line.getAttribute('d')))).not.toEqual(originalLines);
    await page.keyboard.press('Control+z');
    expect(await canvasPositions(graph)).toEqual(original);
    await page.keyboard.press('Control+Shift+z');
    expect(await canvasPositions(graph)).toEqual(moved);

    await header.click({ button: 'right' });
    await page.getByRole('menuitem', { name: '隐藏此模块', exact: true }).click();
    await expect(header).toHaveCount(0);
    await expect(card).toHaveCount(0);
    await expect(lines).not.toHaveCount(9);
    await filterButton(page).click();
    const toggle = layerControls.getByRole('button', { name, exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await filterButton(page).click();
    await expect(lines).toHaveCount(9);
    expect(await canvasPositions(graph)).toEqual(moved);
  }
});

test('仅查看所选支持直连和一个中间节点的路径，返回保留原视角', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await seedNetwork(page);
  await page.evaluate(async () => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    useKnowledgeStore.getState().linkLog('atlas', 'sprite-log', '图集练习。');
    useKnowledgeStore.getState().linkLog('sprite', 'sprite-log', '切片练习。');
  });
  await page.goto('/#network');
  const graph = page.getByRole('group', { name: '知识网络图', exact: true });
  const sidebar = page.getByRole('complementary', { name: '知识网络详情' });
  const nodes = graph.locator('.network-node');
  const lines = graph.locator('.network-line');
  const sprite = graph.getByRole('button', { name: '精灵切片', exact: true });
  const middle = sidebar.getByRole('checkbox', { name: '显示中间节点（两跳）', exact: true });
  const camera = () => graph.locator('.network-board').evaluate((element: HTMLElement) => element.style.transform);
  await page.getByRole('button', { name: '缩小知识网络' }).click();
  const before = await camera();
  await graph.getByRole('button', { name: '像素单位', exact: true }).click({ modifiers: ['Shift'] });
  await graph.getByRole('button', { name: '图集', exact: true }).click({ modifiers: ['Shift'] });
  await sidebar.getByRole('button', { name: '仅查看所选', exact: true }).click();
  await expect(nodes).toHaveCount(2);
  await expect(lines).toHaveCount(0);
  await expect(sidebar.getByText('所选节点之间没有直接连线。')).toBeVisible();
  await expect(middle).not.toBeChecked();

  await middle.check();
  await expect(nodes).toHaveCount(4);
  await expect(lines).toHaveCount(4);
  await expect(graph.locator('.network-node[data-intermediate]')).toHaveCount(2);
  await expect(sprite).toHaveAttribute('aria-pressed', 'false');
  await expect(graph.getByRole('button', { name: '指针输入', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('network-selection.png') });
  await graph.getByRole('button', { name: '查看 像素单位 与 精灵切片 的关系（素材设置）', exact: true }).click();
  const relationLabel = sidebar.getByLabel('连线标签');
  await expect(relationLabel).toHaveValue('素材设置');
  await expect(nodes).toHaveCount(4);
  const area = (await graph.boundingBox())!;
  const beforePan = await camera();
  await page.mouse.move(area.x + 12, area.y + 12);
  await page.mouse.down();
  await page.mouse.move(area.x + 67, area.y + 37, { steps: 6 });
  await page.mouse.up();
  await expect(relationLabel).toHaveValue('素材设置');
  expect(await camera()).not.toBe(beforePan);
  await graph.click({ position: { x: 12, y: 12 }, modifiers: ['Shift'] });
  await expect(relationLabel).toHaveValue('素材设置');

  const afterPan = await camera();
  await graph.click({ position: { x: 12, y: 12 } });
  await expect(relationLabel).toHaveCount(0);
  await expect(sidebar.getByRole('heading', { name: '已选 2 个节点' })).toBeVisible();
  await expect(middle).toBeChecked();
  await expect(nodes).toHaveCount(4);
  await expect(graph.locator('.network-node[aria-pressed="true"]')).toHaveCount(2);
  expect(await camera()).toBe(afterPan);

  for (const name of ['精灵切片', '像素单位']) {
    await graph.getByRole('button', { name, exact: true }).click();
    const nodeHeading = sidebar.getByRole('heading', { name, exact: true });
    await expect(nodeHeading).toBeVisible();
    const beforeReturn = await camera();
    await graph.click({ position: { x: 12, y: 12 } });
    await expect(nodeHeading).toHaveCount(0);
    await expect(sidebar.getByRole('heading', { name: '已选 2 个节点' })).toBeVisible();
    await expect(middle).toBeChecked();
    await expect(nodes).toHaveCount(4);
    await expect(graph.locator('.network-node[aria-pressed="true"]')).toHaveCount(2);
    expect(await camera()).toBe(beforeReturn);
  }

  await filterButton(page).click();
  const logLayer = page.getByRole('group', { name: '知识网络图层' }).getByRole('button', { name: '学习日志', exact: true });
  await logLayer.click();
  await expect(nodes).toHaveCount(3);
  await expect(lines).toHaveCount(2);
  await logLayer.click();
  await filterButton(page).click();
  await sidebar.getByRole('button', { name: '返回完整视图', exact: true }).click();
  await expect(nodes).toHaveCount(15);
  expect(await camera()).toBe(before);
  await expect(graph.locator('.network-node[aria-pressed="true"]')).toHaveCount(2);
  await sprite.click({ modifiers: ['Shift'] });
  await sidebar.getByRole('button', { name: '仅查看所选', exact: true }).click();
  await expect(middle).not.toBeChecked();
  await expect(nodes).toHaveCount(3);
  await expect(lines).toHaveCount(2);
  await middle.check();
  await expect(nodes).toHaveCount(4);
  await expect(lines).toHaveCount(4);
});
