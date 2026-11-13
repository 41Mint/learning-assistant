import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { LogReviewRequest } from '../src/types/logReview';
import type { ChatRequest } from '../src/types/assistantChat';

const date = '2026-11-05';
const text = '## Unity 素材实践\n\n我用 PPU 调整了素材导入比例。\n用 Tilemap 拼出地面。';

async function openReview(page: Page, content = text) {
  await page.addInitScript(({ date, content }) => {
    if (localStorage.getItem('log-review-seeded')) return;
    localStorage.setItem('log-review-seeded', '1');
    localStorage.setItem('learning-assistant:study-logs', JSON.stringify([
      { id: 'review-log', date, content, duration: 25, tags: ['原有标签'], knowledgePoints: [], createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('learning-assistant:knowledge', JSON.stringify({
      version: 1,
      entries: [
        { id: 'pixel-unit', title: '像素单位', aliases: ['PPU'], category: '2D 素材', content: '', createdAt: 1, updatedAt: 1 },
        { id: 'scene', title: '场景', aliases: [], category: 'Unity', content: '', createdAt: 1, updatedAt: 1 },
      ],
      logLinks: [{ id: 'old-link', entryId: 'scene', logId: 'review-log', note: '原有情境' }], relations: [],
    }));
  }, { date, content });
  await page.goto('/#history/' + date);
  await page.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  const editor = page.getByRole('form', { name: '历史记录编辑表单' });
  const launcher = page.getByRole('button', { name: '打开学习智能体' });
  await launcher.click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByText('当前日志 · ' + date, { exact: true })).toBeVisible();
  return { editor, assistant, launcher, close: assistant.getByRole('button', { name: '关闭学习智能体' }) };
}

test('日志整理查询别名和关联，仅保存勾选并核对过的建议', async ({ page }) => {
  await page.route('**/api/log-review', async (route) => {
    const input: LogReviewRequest = route.request().postDataJSON();
    expect(input.text).toBe(text);
    if (input.stage === 'plan') { await route.fulfill({ json: { queries: ['PPU', 'Tilemap'] } }); return; }
    expect(input.context.entries).toContainEqual(expect.objectContaining({ id: 'pixel-unit', title: '像素单位' }));
    expect(input.context.related).toContainEqual(expect.objectContaining({ title: '场景', kind: 'entry' }));
    await route.fulfill({ json: { summary: '整理了素材导入和瓦片地图。', suggestions: [
      { kind: 'tag', tag: 'Unity', evidence: 'Unity 素材实践' },
      { kind: 'tag', tag: '跳过这项', evidence: '素材导入比例' },
      { kind: 'tag', tag: '原有标签', evidence: '素材导入比例' },
      { kind: 'tag', tag: '没有原文依据', evidence: '日志不存在的内容' },
      { kind: 'link', entryId: 'scene', note: '模型生成的说明', evidence: '素材导入比例' },
      { kind: 'link', entryId: 'unknown', note: '', evidence: '素材导入比例' },
      { kind: 'entry', title: 'PPU', category: '2D 素材', content: '像素与单位比例。', evidence: '我用 PPU 调整了素材导入比例。' },
      { kind: 'entry', title: 'Tilemap', category: 'Unity', content: '用瓦片拼出地面。', evidence: '用 Tilemap 拼出地面。' },
    ] } });
  });
  const { editor, assistant, launcher, close } = await openReview(page);
  await assistant.getByRole('button', { name: '生成整理建议', exact: true }).click();
  await expect(assistant.getByRole('checkbox')).toHaveCount(4);
  await expect(assistant.getByText('我用 PPU 调整了素材导入比例。', { exact: true })).toHaveCount(0);
  await expect(assistant.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await assistant.getByRole('checkbox', { name: '添加标签 · Unity', exact: true }).check();
  await assistant.getByRole('button', { name: '详情 · 添加标签 · Unity', exact: true }).click();
  await expect(assistant.getByRole('checkbox')).toHaveCount(0);
  await assistant.getByRole('textbox', { name: '标签', exact: true }).fill('Unity 实践');
  await assistant.getByRole('button', { name: '← 返回建议', exact: true }).click();
  await assistant.getByRole('checkbox', { name: '关联词条 · 像素单位', exact: true }).check();
  await assistant.getByRole('button', { name: '详情 · 关联词条 · 像素单位', exact: true }).click();
  await expect(assistant.getByText('我用 PPU 调整了素材导入比例。', { exact: true })).toBeVisible();
  await assistant.getByRole('textbox', { name: '关联说明', exact: true }).fill('在导入素材时验证。');
  await assistant.getByRole('button', { name: '← 返回建议', exact: true }).click();
  await assistant.getByRole('checkbox', { name: '新建词条 · Tilemap', exact: true }).check();
  await assistant.getByRole('button', { name: '详情 · 新建词条 · Tilemap', exact: true }).click();
  await assistant.getByRole('textbox', { name: '词条分类', exact: true }).fill('2D 素材');
  await close.click();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '成长记录', exact: true }).click();
  await launcher.click();
  await expect(assistant.getByRole('textbox', { name: '词条分类', exact: true })).toHaveCount(0);
  await close.click();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾', exact: true }).click();
  await launcher.click();
  await expect(assistant.getByRole('textbox', { name: '词条分类', exact: true })).toHaveValue('2D 素材');
  await assistant.getByRole('button', { name: '返回日志', exact: true }).click();
  await expect(editor.getByText('已选 3 项整理建议，将随日志保存。')).toBeVisible();
  await expect(page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:knowledge')!).entries.length)).resolves.toBe(2);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'learning-assistant:study-logs') {
        Storage.prototype.setItem = original;
        throw new DOMException('测试日志存储失败', 'QuotaExceededError');
      }
      original.call(this, key, value);
    };
  });
  await editor.getByRole('button', { name: '保存补充', exact: true }).click();
  await expect(editor.getByRole('alert')).toHaveText('测试日志存储失败');
  await expect(page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:knowledge')!).entries.length)).resolves.toBe(2);
  await editor.getByRole('button', { name: '保存补充', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.reload();
  const data = await page.evaluate(() => ({
    log: JSON.parse(localStorage.getItem('learning-assistant:study-logs')!).find((item: { id: string }) => item.id === 'review-log'),
    knowledge: JSON.parse(localStorage.getItem('learning-assistant:knowledge')!),
  }));
  expect(data.log).toMatchObject({ content: text, duration: 25, tags: ['原有标签', 'Unity 实践'] });
  const created = data.knowledge.entries.find((item: { title: string }) => item.title === 'Tilemap');
  expect(created).toMatchObject({ category: '2D 素材', content: '用瓦片拼出地面。' });
  expect(data.knowledge.logLinks).toEqual(expect.arrayContaining([
    expect.objectContaining({ entryId: 'scene', note: '原有情境' }),
    expect.objectContaining({ entryId: 'pixel-unit', note: '在导入素材时验证。' }),
    expect.objectContaining({ entryId: created.id, logId: 'review-log' }),
  ]));
});

test('改变整理范围会重新查询，正文变化后需要重新生成或取消勾选', async ({ page }) => {
  const requests: LogReviewRequest[] = [];
  await page.route('**/api/log-review', async (route) => {
    const input: LogReviewRequest = route.request().postDataJSON();
    requests.push(input);
    const focused = Boolean(input.focus);
    if (input.stage === 'plan') { await route.fulfill({ json: { queries: [focused ? 'Tilemap' : 'PPU'] } }); return; }
    await route.fulfill({ json: { suggestions: [
      { kind: 'tag', tag: focused ? 'Tilemap' : 'PPU', evidence: focused ? '用 Tilemap 拼出地面。' : '素材导入比例' },
    ] } });
  });
  const { editor, assistant, launcher, close } = await openReview(page);
  await assistant.getByRole('button', { name: '生成整理建议', exact: true }).click();
  await assistant.getByRole('checkbox', { name: '添加标签 · PPU', exact: true }).check();
  await assistant.getByLabel('整理范围（可选）').fill('只整理 Tilemap');
  await assistant.getByRole('button', { name: '重新生成建议', exact: true }).click();
  const choice = assistant.getByRole('checkbox', { name: '添加标签 · Tilemap', exact: true });
  await expect(choice).toBeVisible();
  expect(requests.slice(2).map(({ focus }) => focus)).toEqual(['只整理 Tilemap', '只整理 Tilemap']);
  await expect(assistant.getByRole('checkbox', { name: '添加标签 · PPU', exact: true })).toHaveCount(0);
  await choice.check();
  await close.click();
  await editor.getByRole('textbox', { name: '历史学习内容', exact: true }).fill(text + '\n\n补了一句。');
  await editor.getByRole('button', { name: '保存补充', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('正文已修改');
  await launcher.click();
  await choice.uncheck();
  await close.click();
  await editor.getByRole('button', { name: '保存补充', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByText('补了一句。', { exact: true })).toBeVisible();
});

test('资料不足和接口失败都有反馈，正文仍可保存', async ({ page }) => {
  let failed = false;
  await page.route('**/api/log-review', async (route) => {
    if (failed) { await route.fulfill({ status: 502, json: { error: 'DeepSeek 暂时不可用，请重试。' } }); return; }
    const input: LogReviewRequest = route.request().postDataJSON();
    await route.fulfill({ json: input.stage === 'plan' ? { queries: [] } : { summary: '这篇日志缺少可整理的具体内容。', suggestions: [] } });
  });
  const { editor, assistant, close } = await openReview(page, '今天简单看了教程。');
  await assistant.getByRole('button', { name: '生成整理建议', exact: true }).click();
  await expect(assistant.getByText('这篇日志缺少可整理的具体内容。')).toBeVisible();
  await expect(assistant.getByRole('checkbox')).toHaveCount(0);
  failed = true;
  await assistant.getByRole('button', { name: '重新生成建议', exact: true }).click();
  await expect(assistant.getByRole('alert')).toHaveText('DeepSeek 暂时不可用，请重试。');
  await close.click();
  await editor.getByRole('textbox', { name: '历史学习内容', exact: true }).fill('补充学习记录');
  await editor.getByRole('button', { name: '保存补充', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByText('补充学习记录', { exact: true })).toBeVisible();
});

test('浮动图标可拖动，刷新保留位置，窄屏使用底部抽屉', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#path');
  const launcher = page.getByRole('button', { name: '打开学习智能体' });
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  const before = (await launcher.boundingBox())!;
  await page.mouse.move(before.x + 24, before.y + 24);
  await page.mouse.down();
  await page.mouse.move(90, 450, { steps: 6 });
  await page.mouse.up();
  await expect(assistant).toBeHidden();
  const after = (await launcher.boundingBox())!;
  expect(after.x).toBeCloseTo(66);
  expect(after.y).toBeCloseTo(426);
  await page.reload();
  expect(await launcher.boundingBox()).toEqual(after);
  await launcher.press('Enter');
  const box = (await assistant.boundingBox())!;
  expect(box.width).toBe(390);
  expect(box.y + box.height).toBeCloseTo(844);
  await page.screenshot({ path: testInfo.outputPath('assistant-drawer-mobile.png') });
  await page.keyboard.press('Escape');
  await expect(assistant).toBeHidden();
  await expect(launcher).toBeFocused();
});

test('桌面智能体可移动、缩放和靠边，背后页面可继续操作', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/#path');
  const launcher = page.getByRole('button', { name: '打开学习智能体' });
  const window = page.getByRole('dialog', { name: '学习智能体' });
  const menu = page.getByRole('group', { name: '窗口操作' });
  await launcher.click({ button: 'right' });
  await menu.getByRole('button', { name: '靠左', exact: true }).click();
  await expect(window).toBeVisible();
  expect((await window.boundingBox())!.x).toBe(8);
  expect(await window.evaluate((element) => element.matches(':modal'))).toBe(false);

  const title = window.getByRole('heading', { name: '学习智能体' });
  const heading = (await title.boundingBox())!;
  await page.mouse.move(heading.x + 20, heading.y + 8);
  await page.mouse.down();
  await page.mouse.move(heading.x + 240, heading.y - 42, { steps: 8 });
  await page.mouse.up();
  expect((await window.boundingBox())!.x).toBe(228);
  const previous = (await window.boundingBox())!;
  const grip = window.getByRole('button', { name: '调整智能体窗口大小' });
  const size = (await grip.boundingBox())!;
  await page.mouse.move(size.x + 12, size.y + 12);
  await page.mouse.down();
  await page.mouse.move(size.x + 92, size.y - 48, { steps: 8 });
  await page.mouse.up();
  const saved = (await window.boundingBox())!;
  expect(saved.width).toBe(previous.width + 80);
  expect(saved.height).toBe(previous.height - 60);

  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '今日学习', exact: true }).click();
  await expect(page).toHaveURL(/#today$/);
  await expect(window).toBeVisible();
  await window.getByRole('textbox', { name: '输入问题' }).fill('尚未发送');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => window.evaluate((element) => element.matches(':modal'))).toBe(true);
  await expect(window.getByRole('textbox', { name: '输入问题' })).toHaveValue('尚未发送');
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect.poll(() => window.evaluate((element) => element.matches(':modal'))).toBe(false);
  expect(await window.boundingBox()).toEqual(saved);
  await page.reload();
  await launcher.click();
  await expect(window).toBeVisible();
  expect(await window.boundingBox()).toEqual(saved);
  await title.click({ button: 'right' });
  await menu.getByRole('button', { name: '靠右', exact: true }).click();
  const right = (await window.boundingBox())!;
  expect(right.x + right.width).toBe(1272);
  await window.getByRole('button', { name: '窗口选项' }).click();
  await expect(menu.getByRole('button', { name: '靠左' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(window).toBeVisible();
  await window.getByRole('button', { name: '窗口选项' }).click();
  await menu.getByRole('button', { name: '恢复默认位置和大小' }).click();
  expect((await window.boundingBox())!.width).toBe(440);
  await page.screenshot({ path: testInfo.outputPath('assistant-window.png') });
});

test('自由问答保留追问，只有显式勾选时才引用当前日志草稿', async ({ page }, testInfo) => {
  const calls: ChatRequest[] = [];
  let fail = false;
  await page.route('**/api/assistant-chat', async (route) => {
    calls.push(route.request().postDataJSON());
    if (fail) await route.fulfill({ status: 502, json: { error: 'DeepSeek 暂时不可用，请重试。' } });
    else await route.fulfill({ json: { answer: `**回复 ${calls.length}**\n\nPPU 是每单位像素数。` } });
  });
  const { editor, assistant, launcher, close } = await openReview(page);
  await assistant.getByRole('button', { name: '自由问答' }).click();
  const input = assistant.getByRole('textbox', { name: '输入问题' });
  const reference = assistant.getByRole('checkbox', { name: '引用当前日志 · ' + date + '（草稿）', exact: true });
  await expect(reference).not.toBeChecked();
  await input.fill('PPU 是什么？');
  await input.press('Enter');
  await expect(assistant.getByText('回复 1', { exact: true })).toBeVisible();
  expect(calls[0]).toEqual({ question: 'PPU 是什么？', history: [] });
  await input.fill('能举个例子吗？');
  await assistant.getByRole('button', { name: '发送', exact: true }).click();
  await expect(assistant.getByText('回复 2', { exact: true })).toBeVisible();
  expect(calls[1].history).toEqual([
    { role: 'user', content: 'PPU 是什么？' },
    { role: 'assistant', content: '**回复 1**\n\nPPU 是每单位像素数。' },
  ]);
  expect(calls[1].log).toBeUndefined();

  await close.click();
  const draft = text + '\n\n这一句还没保存。';
  await editor.getByRole('textbox', { name: '历史学习内容' }).fill(draft);
  await launcher.click();
  await reference.check();
  await input.fill('我的理解对吗？');
  await input.press('Enter');
  await expect(assistant.getByText('回复 3', { exact: true })).toBeVisible();
  expect(calls[2]).toEqual({ question: '我的理解对吗？', history: [], log: { date, text: draft } });
  await expect(assistant.getByText(`引用 ${date} · 草稿`, { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('assistant-chat.png') });

  await close.click();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '知识词条', exact: true }).click();
  await launcher.click();
  await expect(reference).toHaveCount(0);
  await expect(assistant.getByText('回复 3', { exact: true })).toBeVisible();
  fail = true;
  await input.fill('再举一个例子');
  await input.press('Enter');
  await expect(assistant.getByRole('alert')).toHaveText('DeepSeek 暂时不可用，请重试。');
  expect(calls[3].log).toBeUndefined();
  expect(calls[3].history).toHaveLength(4);
  await expect(input).toHaveValue('再举一个例子');
  fail = false;
  await input.press('Enter');
  await expect(assistant.getByText('回复 5', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('');
  await close.click();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾', exact: true }).click();
  await launcher.click();
  await expect(reference).not.toBeChecked();
  await expect(editor.getByRole('textbox', { name: '历史学习内容' })).toHaveValue(draft);

  let complete: () => void;
  const release = new Promise<void>((resolve) => { complete = resolve; });
  await page.route('**/api/assistant-chat', async (route) => {
    await release;
    await route.fulfill({ json: { answer: '已取消的回复' } }).catch(() => {});
  }, { times: 1 });
  await input.fill('这条随后取消');
  const requested = page.waitForRequest('**/api/assistant-chat');
  await input.press('Enter');
  await requested;
  await assistant.getByRole('button', { name: '停止', exact: true }).click();
  complete!();
  await expect(input).toHaveValue('这条随后取消');
  await expect(assistant.getByText('已取消的回复', { exact: true })).toHaveCount(0);
});
