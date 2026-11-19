import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { LogReviewRequest } from '../src/types/logReview';
import type { ChatRequest } from '../src/types/assistantChat';
import type { ReviewConversationRequest, ReviewOperation } from '../src/types/reviewConversation';

const date = '2026-11-05';
const text = '## Unity 素材实践\n\n我用 PPU 调整了素材导入比例。\n用 Tilemap 拼出地面。';

async function seedReview(page: Page, content = text, includeOlder = false) {
  await page.addInitScript(({ date, content, includeOlder }) => {
    if (localStorage.getItem('log-review-seeded')) return;
    localStorage.setItem('log-review-seeded', '1');
    localStorage.setItem('learning-assistant:study-logs', JSON.stringify([
      { id: 'review-log', date, content, duration: 25, tags: ['原有标签'], knowledgePoints: [], createdAt: 1, updatedAt: 1 },
      ...(includeOlder ? [{ id: 'older-log', date: '2025-11-05', content: '## 旧年学习记录', duration: 5, tags: [], knowledgePoints: [], createdAt: 1, updatedAt: 1 }] : []),
    ]));
    localStorage.setItem('learning-assistant:knowledge', JSON.stringify({
      version: 1,
      entries: [
        { id: 'pixel-unit', title: '像素单位', aliases: ['PPU'], category: '2D 素材', content: '', createdAt: 1, updatedAt: 1 },
        { id: 'scene', title: '场景', aliases: [], category: 'Unity', content: '', createdAt: 1, updatedAt: 1 },
      ],
      logLinks: [{ id: 'old-link', entryId: 'scene', logId: 'review-log', note: '原有情境' }], relations: [],
    }));
  }, { date, content, includeOlder });
}

async function openReview(page: Page, content = text, manual = true) {
  await seedReview(page, content);
  await page.goto('/#history/' + date);
  await page.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  const editor = page.getByRole('form', { name: '历史记录编辑表单' });
  const launcher = page.getByRole('button', { name: '打开学习智能体' });
  await launcher.click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await expect(assistant.getByText('当前日志 · ' + date, { exact: true })).toBeVisible();
  if (manual) await assistant.getByRole('region', { name: '日志整理建议' }).getByText('手动操作', { exact: true }).click();
  return { editor, assistant, launcher, close: assistant.getByRole('button', { name: '关闭学习智能体' }) };
}

test('只用聊天提炼、询问、按字段编辑、撤销并保存，不需要勾选', async ({ page }) => {
  const longName = '输入方向与 Rigidbody 2D 实际运动速度的差异';
  const body = '输入方向来自 Move，刚体速度表示实际运动。读取输入不等于驱动刚体。';
  const evidence = '用 Tilemap 拼出地面。';
  const requests: ReviewConversationRequest[] = [];
  let wrongField = false;
  let unexpectedEditOnQuestion = false;
  await page.route('**/api/log-review', async (route) => {
    const input = route.request().postDataJSON() as LogReviewRequest | ReviewConversationRequest;
    if (input.stage === 'plan') return route.fulfill({ json: { queries: [] } });
    if (input.stage === 'suggest') return route.fulfill({ json: { summary: '已提炼出两个词条。', suggestions: [
      { kind: 'entry', title: longName, category: 'Input System', content: body, evidence },
      { kind: 'entry', title: '另一个词条', category: '2D', content: '第二条原正文。', evidence },
    ] } });
    if (input.stage !== 'conversation') throw new Error('unexpected legacy request');
    requests.push(input);
    const reply = (answer: string, operation?: ReviewOperation) => route.fulfill({ json: { answer, operation } });
    if (input.question === '找找这篇里有什么值得记下来的') return reply('准备整理。', { kind: 'generate', focus: '提炼可复用知识' });
    if (input.question.startsWith('词条名称为什么')) return reply('这个名称把两个概念和区别写在了一起。',
      unexpectedEditOnQuestion ? { kind: 'edit', edits: [{ id: 1, fields: { title: '不该修改' } }] } : undefined);
    if (input.question.includes('正文别动')) return reply('准备修改。', { kind: 'edit', edits: [
      { id: 1, fields: wrongField ? { content: '错误地改了正文。' } : { title: '输入与刚体速度' } },
    ] });
    if (input.question === '放到「输入」分类吧') return reply('准备分类。', { kind: 'edit', edits: [{ id: 1, fields: { category: '输入' } }] });
    if (input.question === '分类还是恢复成刚才的') return reply('准备撤销。', { kind: 'undo' });
    if (input.question === '刚才改的那条留下吧') return reply('准备保存。', { kind: 'save', ids: [1] });
    throw new Error('unexpected question: ' + input.question);
  });
  const { assistant } = await openReview(page, text, false);
  const input = assistant.getByRole('textbox', { name: '输入问题' });
  const type = async (message: string) => { await input.fill(message); await input.press('Enter'); };
  const transcript = assistant.getByRole('log');
  await expect(assistant.getByRole('button', { name: '生成整理建议', exact: true })).toBeHidden();
  await type('找找这篇里有什么值得记下来的');
  await expect(transcript.getByText(/整理出 2 项草稿/)).toBeVisible();
  await expect(assistant.getByRole('checkbox')).toHaveCount(0);
  await type('词条名称为什么这么长');
  await expect(transcript.getByText('这个名称把两个概念和区别写在了一起。')).toBeVisible();
  const originalCard = assistant.getByRole('button', { name: '展开 · 新建词条 · ' + longName, exact: true });
  await expect(originalCard).toBeVisible();
  unexpectedEditOnQuestion = true;
  await type('词条名称为什么还那么长');
  await expect(transcript.getByText('这是在问原因，我没有修改草稿。')).toBeVisible();
  await expect(originalCard).toBeVisible();

  wrongField = true;
  await type('把第一条的名称改短，正文别动');
  await expect(assistant.getByRole('alert')).toContainText('草稿没有改变');
  await expect(originalCard).toBeVisible();
  wrongField = false;
  await type('把第一条的名称改短，正文别动');
  await expect(assistant.getByRole('button', { name: '展开 · 新建词条 · 输入与刚体速度' })).toBeVisible();
  expect(requests.at(-1)?.items.every(({ selected }) => !selected)).toBe(true);
  await type('放到「输入」分类吧');
  await expect(transcript.getByText(/已修改分类/)).toBeVisible();
  expect(requests.at(-1)?.history.map(({ content }) => content)).toContain('把第一条的名称改短，正文别动');
  expect(requests.at(-1)?.lastEdited).toEqual([1]);
  await type('分类还是恢复成刚才的');
  await expect(transcript.getByText(/已撤销 1 项草稿/)).toBeVisible();
  const entries = () => page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:knowledge')!).entries);
  expect((await entries()).map((item: { title: string }) => item.title)).not.toContain('输入与刚体速度');
  await type('刚才改的那条留下吧');
  await expect(transcript.getByText(/要保存第 1 项.*还没有写入/)).toBeVisible();
  expect((await entries()).map((item: { title: string }) => item.title)).not.toContain('输入与刚体速度');
  await type('确认');
  await expect(transcript.getByText('已保存：「输入与刚体速度」。')).toBeVisible();
  expect(await entries()).toContainEqual(expect.objectContaining({ title: '输入与刚体速度', category: 'Input System', content: expect.stringContaining(body) }));
  expect((await entries()).map((item: { title: string }) => item.title)).not.toContain('另一个词条');
  await expect(input).toHaveValue('');
});

test('建议菜单只保存当前项，引用建议保留输入并指向准确的编号', async ({ page }) => {
  const requests: ReviewConversationRequest[] = [];
  await page.route('**/api/log-review', async (route) => {
    const input = route.request().postDataJSON() as LogReviewRequest | ReviewConversationRequest;
    if (input.stage === 'plan') return route.fulfill({ json: { queries: [] } });
    if (input.stage === 'suggest') return route.fulfill({ json: { summary: '两条建议', suggestions: [
      { kind: 'tag', tag: 'Tilemap', evidence: '用 Tilemap 拼出地面。' },
      { kind: 'entry', title: 'Tilemap', category: '2D', content: '用瓦片组成地图。', evidence: '用 Tilemap 拼出地面。' },
    ] } });
    if (input.stage !== 'conversation') throw new Error('unexpected legacy request');
    requests.push(input);
    if (!input.items.length) return route.fulfill({ json: { answer: '准备整理。', operation: { kind: 'generate', focus: '' } } });
    return route.fulfill({ json: { answer: input.referenceId === 2 ? '这条建议是一个词条。' : '这一轮没有引用建议。' } });
  });
  const { assistant } = await openReview(page, text, false);
  const input = assistant.getByRole('textbox', { name: '输入问题' });
  await input.fill('找找这篇里有什么值得记下来的');
  await input.press('Enter');
  const entry = assistant.getByRole('button', { name: '展开 · 新建词条 · Tilemap' });
  const tag = assistant.getByRole('button', { name: '展开 · 添加标签 · Tilemap' });
  const menu = assistant.getByRole('menu', { name: '建议操作' });
  await expect(entry).toBeVisible();
  await input.fill('这条建议是什么？');
  await entry.press('Shift+F10');
  await expect(menu.getByRole('menuitem', { name: '保存这条建议' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(entry).toBeFocused();
  await entry.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '引用这条建议继续询问' }).click();
  const reference = assistant.getByRole('group', { name: '已引用的建议' });
  await expect(reference).toContainText('第 2 项「Tilemap」');
  await expect(input).toHaveValue('这条建议是什么？');
  await expect(input).toBeFocused();
  expect(requests).toHaveLength(1);

  await tag.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '保存这条建议' }).click();
  await expect(tag).toContainText('已保存');
  await expect(entry).not.toContainText('已保存');
  await expect(reference).toBeVisible();
  await tag.click({ button: 'right' });
  await expect(menu.getByRole('menuitem', { name: '保存这条建议' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await input.press('Enter');
  await expect(assistant.getByRole('log').getByText('这条建议是一个词条。')).toBeVisible();
  expect(requests.at(-1)?.referenceId).toBe(2);
  const data = await page.evaluate(() => ({
    tags: JSON.parse(localStorage.getItem('learning-assistant:study-logs')!)[0].tags,
    entries: JSON.parse(localStorage.getItem('learning-assistant:knowledge')!).entries,
  }));
  expect(data.tags).toContain('Tilemap');
  expect(data.entries).not.toContainEqual(expect.objectContaining({ title: 'Tilemap' }));
  await reference.getByRole('button', { name: '移除建议引用' }).click();
  await input.fill('继续说说这篇日志。');
  await input.press('Enter');
  await expect(assistant.getByRole('log').getByText('这一轮没有引用建议。')).toBeVisible();
  expect(requests.at(-1)?.referenceId).toBeUndefined();
});

test('自然语言可从普通问答发起整理，正文精简达不到要求不覆盖草稿', async ({ page }) => {
  await seedReview(page);
  const original = '这一篇记录里先解释输入向量的来源，然后解释实际刚体速度的含义，最后强调两者不能互相替代。';
  await page.route('**/api/assistant-chat', async (route) => {
    const input = route.request().postDataJSON() as ChatRequest;
    expect(input.log).toBeUndefined();
    await route.fulfill({ json: { answer: '我来打开那篇学习记录。', action: { kind: 'review', date, focus: '优先总结关键区别' } } });
  });
  await page.route('**/api/log-review', async (route) => {
    const input = route.request().postDataJSON() as LogReviewRequest | ReviewConversationRequest;
    if (input.stage === 'plan') {
      expect(input.focus).toBe('优先总结关键区别');
      return route.fulfill({ json: { queries: [] } });
    }
    if (input.stage === 'suggest') return route.fulfill({ json: { suggestions: [
      { kind: 'entry', title: '输入与速度', category: '输入', content: original, evidence: '用 Tilemap 拼出地面。' },
    ] } });
    return route.fulfill({ json: { answer: '准备修订。', operation: { kind: 'edit', edits: [
      { id: 1, fields: { content: original.replace('先解释', '首先解释') } },
    ] } } });
  });
  await page.goto('/#path');
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  const input = assistant.getByRole('textbox', { name: '输入问题' });
  await input.fill('十一月五号我记了什么？挑出值得长期记住的要点');
  await input.press('Enter');
  const card = assistant.getByRole('button', { name: '展开 · 新建词条 · 输入与速度' });
  await card.click();
  await expect(assistant.getByText(original, { exact: true })).toBeVisible();
  await input.fill('这条正文有点冗长，再精简一下');
  await input.press('Enter');
  await expect(assistant.getByRole('alert')).toContainText('正文没有达到缩短要求');
  await expect(assistant.getByText(original, { exact: true })).toBeVisible();
});

test('文本保存词条不会顺带提交编辑中的日志正文', async ({ page }) => {
  const title = '日志中的 Tilemap';
  await page.route('**/api/log-review', async (route) => {
    const input = route.request().postDataJSON() as LogReviewRequest | ReviewConversationRequest;
    if (input.stage === 'plan') return route.fulfill({ json: { queries: [] } });
    if (input.stage === 'suggest') return route.fulfill({ json: { suggestions: [
      { kind: 'entry', title, category: '', content: 'Tilemap 用于布置瓦片。', evidence: '用 Tilemap 拼出地面。' },
    ] } });
    const operation = input.question.startsWith('帮我') ? { kind: 'generate', focus: '' } : { kind: 'save', ids: [1] };
    return route.fulfill({ json: { answer: '明白。', operation } });
  });
  const { editor, assistant, close, launcher } = await openReview(page, text, false);
  const dirty = text + '\n\n还没保存的一句。';
  await close.click();
  await editor.getByRole('textbox', { name: '历史学习内容', exact: true }).fill(dirty);
  await launcher.click();
  const input = assistant.getByRole('textbox', { name: '输入问题' });
  const send = async (message: string) => { await input.fill(message); await input.press('Enter'); };
  await send('帮我整理这篇笔记');
  await expect(assistant.getByRole('button', { name: '展开 · 新建词条 · ' + title })).toBeVisible();
  await send('保存第 1 项词条');
  await expect(assistant.getByRole('alert')).toContainText('还有未保存的正文');
  const getSaved = () => page.evaluate(() => ({
    body: JSON.parse(localStorage.getItem('learning-assistant:study-logs')!)[0].content,
    titles: JSON.parse(localStorage.getItem('learning-assistant:knowledge')!).entries.map((entry: { title: string }) => entry.title),
  }));
  expect((await getSaved()).body).toBe(text);
  expect((await getSaved()).titles).not.toContain(title);
  await send('把正文和第 1 项一起保存');
  await expect(assistant.getByText('已保存：「' + title + '」。')).toBeVisible();
  expect((await getSaved()).body).toBe(dirty);
  expect((await getSaved()).titles).toContain(title);
});

test('模型建议的下一步只有用户选择后才作为消息发送', async ({ page }) => {
  await seedReview(page);
  let requests = 0;
  await page.route('**/api/assistant-chat', async (route) => {
    requests += 1;
    await route.fulfill({ json: { answer: '可以先从学习笔记提炼概念，再复习一两个关键点。', options: [
      '帮我总结 2026-11-05 的学习日志，优先提炼关键概念', '删除所有日志',
    ] } });
  });
  let organizing = 0;
  await page.route('**/api/log-review', async (route) => {
    organizing += 1;
    const input = route.request().postDataJSON() as LogReviewRequest;
    await route.fulfill({ json: input.stage === 'plan' ? { queries: [] } : { summary: '已查看日志。', suggestions: [] } });
  });
  await page.goto('/#path');
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  const question = assistant.getByRole('textbox', { name: '输入问题' });
  await question.fill('怎样复习今天学到的知识点？');
  await question.press('Enter');
  const options = assistant.getByRole('group', { name: '可选的下一步' });
  await expect(options.getByRole('button')).toHaveCount(1);
  const option = '帮我总结 2026-11-05 的学习日志，优先提炼关键概念';
  await expect(assistant.getByText('整理日志 · ' + date, { exact: true })).toHaveCount(0);
  expect(organizing).toBe(0);
  await options.getByRole('button', { name: option }).click();
  await expect(assistant.getByRole('log').getByText(option, { exact: true }).last()).toBeVisible();
  await expect(assistant.getByText('整理日志 · ' + date, { exact: true })).toBeVisible();
  await expect.poll(() => organizing).toBe(2);
  expect(requests).toBe(1);
});

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
      { kind: 'entry', title: 'Tilemap', category: '2Ｄ素材', content: '日志示例中用瓦片拼出地面。', citationAnchor: '日志示例', evidence: '用 Tilemap 拼出地面。' },
    ] } });
  });
  const { editor, assistant, launcher, close } = await openReview(page);
  await assistant.getByRole('button', { name: '生成整理建议', exact: true }).click();
  await expect(assistant.getByRole('checkbox')).toHaveCount(5);
  await expect(assistant.getByRole('checkbox', { checked: true })).toHaveCount(0);
  const selectAll = assistant.getByRole('checkbox', { name: '全选建议', exact: true });
  await selectAll.check();
  await expect(assistant.getByText('已选 4 项，随日志保存')).toBeVisible();
  await selectAll.uncheck();
  await expect(assistant.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await assistant.getByRole('checkbox', { name: '添加标签 · Unity', exact: true }).check();
  await expect(selectAll).toHaveJSProperty('indeterminate', true);
  await assistant.getByRole('button', { name: '展开 · 添加标签 · Unity', exact: true }).click();
  await expect(assistant.getByRole('checkbox')).toHaveCount(5);
  await assistant.getByRole('textbox', { name: '标签', exact: true }).fill('Unity 实践');
  await assistant.getByRole('button', { name: '收起 · 添加标签 · Unity 实践', exact: true }).click();
  await expect(assistant.getByRole('textbox', { name: '标签', exact: true })).toHaveCount(0);
  await assistant.getByRole('checkbox', { name: '关联词条 · 像素单位', exact: true }).check();
  await assistant.getByRole('button', { name: '展开 · 关联词条 · 像素单位', exact: true }).click();
  await expect(assistant.getByText('我用 PPU 调整了素材导入比例。', { exact: true })).toBeVisible();
  await assistant.getByRole('textbox', { name: '关联说明', exact: true }).fill('在导入素材时验证。');
  await assistant.getByRole('button', { name: '收起 · 关联词条 · 像素单位', exact: true }).click();
  await assistant.getByRole('checkbox', { name: '新建词条 · Tilemap', exact: true }).check();
  await assistant.getByRole('button', { name: '展开 · 新建词条 · Tilemap', exact: true }).click();
  const category = assistant.getByRole('combobox', { name: '词条分类', exact: true });
  await expect(category).toHaveValue('2D 素材');
  await category.fill('瓦片地图');
  await close.click();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '成长记录', exact: true }).click();
  await launcher.click();
  await expect(category).toHaveValue('瓦片地图');
  await close.click();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾', exact: true }).click();
  await launcher.click();
  await expect(category).toHaveValue('瓦片地图');
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
  expect(created).toMatchObject({ category: '瓦片地图', content: '日志示例[日志引用](<#log-ref/review-log>)中用瓦片拼出地面。' });
  expect(data.knowledge.logLinks).toEqual(expect.arrayContaining([
    expect.objectContaining({ entryId: 'scene', note: '原有情境' }),
    expect.objectContaining({ entryId: 'pixel-unit', note: '在导入素材时验证。' }),
    expect.objectContaining({ entryId: created.id, logId: 'review-log' }),
  ]));
  await page.goto('/#history/' + date);
  const tags = page.getByRole('region', { name: '编辑标签', exact: true });
  await expect(tags.getByRole('button', { name: '移除标签「Unity 实践」' })).toBeVisible();
  await tags.getByRole('textbox', { name: '标签', exact: true }).fill('瓦片地图');
  await tags.getByRole('button', { name: '添加标签' }).click();
  await tags.getByRole('button', { name: '移除标签「原有标签」' }).click();
  await page.reload();
  await expect(tags.getByRole('button', { name: '移除标签「瓦片地图」' })).toBeVisible();
  await expect(tags.getByRole('button', { name: '移除标签「原有标签」' })).toHaveCount(0);
  await page.goto('/#knowledge/' + created.id);
  await expect(page.getByRole('link', { name: '日志引用 1', exact: true })).toHaveAttribute('href', '#history/' + date);
});

test('改变整理范围会重新查询，正文变化后需要重新生成或取消勾选', async ({ page }) => {
  const requests: LogReviewRequest[] = [];
  await page.route('**/api/log-review', async (route) => {
    const input = route.request().postDataJSON() as LogReviewRequest | ReviewConversationRequest;
    if (input.stage === 'conversation') return route.fulfill({ json: { answer: '我重新聚焦于 Tilemap。', operation: { kind: 'generate', focus: input.question } } });
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
  await assistant.getByRole('textbox', { name: '输入问题' }).fill('只整理 Tilemap');
  await assistant.getByRole('textbox', { name: '输入问题' }).press('Enter');
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
  await assistant.getByRole('checkbox', { name: '取消全部选择', exact: true }).click();
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
  await expect(assistant.getByText('这篇日志缺少可整理的具体内容。').first()).toBeVisible();
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
  await assistant.getByText('试试这样问', { exact: true }).click();
  await assistant.getByRole('button', { name: '退出当前资料' }).click();
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

  let received: () => void;
  const intercepted = new Promise<void>((resolve) => { received = resolve; });
  let complete: () => void;
  const release = new Promise<void>((resolve) => { complete = resolve; });
  await page.route('**/api/assistant-chat', async (route) => {
    received!();
    await release;
    await route.fulfill({ json: { answer: '已取消的回复' } }).catch(() => {});
  }, { times: 1 });
  await input.fill('这条随后取消');
  await input.press('Enter');
  try {
    await intercepted;
    await assistant.getByRole('button', { name: '停止', exact: true }).click();
    await expect(assistant.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    await expect(input).toHaveValue('这条随后取消');
  } finally {
    complete!();
  }
  await expect(assistant.getByText('已取消的回复', { exact: true })).toHaveCount(0);
});

test('用对话或快捷问题按日期整理，切换任务后保留各日志的结果', async ({ page }) => {
  await seedReview(page, text, true);
  const requests: LogReviewRequest[] = [];
  let chatCalls = 0;
  await page.route('**/api/assistant-chat', async (route) => {
    chatCalls += 1;
    await route.fulfill({ json: { answer: '接着看上次整理结果。', action: { kind: 'review', date, generate: false } } });
  });
  await page.route('**/api/log-review', async (route) => {
    const input = route.request().postDataJSON() as LogReviewRequest | ReviewConversationRequest;
    if (input.stage === 'conversation') {
      const operation = input.question.startsWith('只整理') ? { kind: 'generate', focus: input.question }
        : input.question === '查找 PPU 的相关资料' ? { kind: 'navigate', action: { kind: 'findResources', query: 'PPU' } }
          : { kind: 'save', ids: [1] };
      return route.fulfill({ json: { answer: '明白。', operation } });
    }
    requests.push(input);
    await route.fulfill({ json: input.stage === 'plan' ? { queries: ['Tilemap'] } : { summary: '找到 Tilemap。', suggestions: [
      { kind: 'tag', tag: '瓦片地图', evidence: '用 Tilemap 拼出地面。' },
    ] } });
  });
  await page.goto('/#path');
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  await assistant.getByText('试试这样问', { exact: true }).click();
  await assistant.getByRole('button', { name: '整理学习日志', exact: true }).click();
  await expect(assistant.getByRole('log').getByText('整理学习日志', { exact: true })).toBeVisible();
  await expect(assistant.getByRole('textbox', { name: '按日期找日志' })).toBeVisible();
  await assistant.getByText('试试这样问', { exact: true }).click();
  await assistant.getByRole('button', { name: '退出当前资料', exact: true }).click();
  const question = assistant.getByRole('textbox', { name: '输入问题' });
  await question.fill('帮我整理11-5的日志');
  await question.press('Enter');
  const dateInput = assistant.getByRole('textbox', { name: '按日期找日志' });
  await expect(question).toHaveAttribute('id', 'assistant-input');
  await expect(dateInput).toHaveValue('11-5');
  await expect(assistant.getByRole('button', { name: '2025-11-05 · 旧年学习记录' })).toBeVisible();
  expect(requests).toHaveLength(0);
  await question.fill('是 2026-11-05');
  await question.press('Enter');
  await expect(assistant.getByRole('button', { name: '2025-11-05 · 旧年学习记录' })).toHaveCount(0);
  await expect(page).toHaveURL(/#path$/);
  await expect(assistant.getByText('整理日志 · ' + date, { exact: true })).toBeVisible();
  await expect(assistant.getByText('找到 Tilemap。', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  const focus = assistant.getByRole('textbox', { name: '输入问题' });
  await focus.fill('只整理 Tilemap');
  await focus.press('Enter');
  await expect.poll(() => requests.length).toBe(4);
  await expect(focus).toHaveValue('');
  expect(requests.map((input) => input.text)).toEqual([text, text, text, text]);
  expect(requests.slice(2).map((input) => input.focus)).toEqual(['只整理 Tilemap', '只整理 Tilemap']);
  await focus.fill('保存第 1 项');
  await focus.press('Enter');
  await expect(assistant.getByText('已保存：「瓦片地图」。')).toBeVisible();
  await focus.fill('查找 PPU 的相关资料');
  await focus.press('Enter');
  await expect(assistant.getByRole('textbox', { name: '检索关键词' })).toHaveValue('PPU');
  await focus.fill('继续看上次那篇的整理结果');
  await focus.press('Enter');
  await expect(assistant.getByText('整理日志 · ' + date, { exact: true })).toBeVisible();
  await expect(focus).toHaveValue('');
  await expect(assistant.getByText('找到 Tilemap。', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(4);
  await assistant.getByRole('button', { name: '选择其他日期' }).click();
  await dateInput.fill('11-5');
  await assistant.getByRole('button', { name: '2025-11-05 · 旧年学习记录' }).click();
  await expect(assistant.getByText('整理日志 · 2025-11-05', { exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: '选择其他日期' }).click();
  await dateInput.fill('01-01');
  await expect(assistant.getByRole('status')).toHaveText('没有找到这一天的日志。');
  await dateInput.fill(date);
  await assistant.getByRole('button', { name: '2026-11-05 · Unity 素材实践' }).click();
  await expect(assistant.getByText('找到 Tilemap。', { exact: true })).toBeVisible();
  await expect(assistant.getByRole('log').getByText('帮我整理11-5的日志')).toBeVisible();
  expect(chatCalls).toBe(1);
});

test('窄屏最小化后可阅读页面并恢复输入，从问答按别名查找并打开词条', async ({ page }) => {
  await seedReview(page);
  let chatCalls = 0;
  await page.route('**/api/assistant-chat', async (route) => { chatCalls += 1; await route.abort(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#path');
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  const restore = page.getByRole('button', { name: '恢复学习智能体' });
  const question = assistant.getByRole('textbox', { name: '输入问题' });
  await question.fill('帮我打开 PPU 词条');
  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await expect(assistant).toBeHidden();
  await expect(restore).toBeFocused();
  await page.getByRole('link', { name: '想尝试', exact: true }).click();
  await restore.click();
  await expect(question).toHaveValue('帮我打开 PPU 词条');
  await question.press('Enter');
  await expect(assistant.getByRole('region', { name: '查找资料' })).toBeVisible();
  await expect(assistant.getByRole('textbox', { name: '检索关键词' })).toHaveValue('ppu');
  await assistant.getByRole('link', { name: '像素单位', exact: true }).click();
  await expect(page).toHaveURL(/#knowledge\/pixel-unit\?find=ppu$/);
  await expect(assistant).toBeHidden();
  await expect(page.getByRole('heading', { name: '像素单位', exact: true })).toBeVisible();
  await restore.click();
  await expect(assistant.getByRole('link', { name: '像素单位', exact: true })).toBeVisible();
  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await page.getByRole('button', { name: '新建词条', exact: true }).click();
  const entryDraft = page.getByRole('textbox', { name: '词条名称（必填）', exact: true });
  await entryDraft.fill('未保存词条');
  await restore.click();
  const popupPromise = page.waitForEvent('popup');
  await assistant.getByRole('link', { name: '像素单位', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole('heading', { name: '像素单位', exact: true })).toBeVisible();
  await popup.close();
  await expect(assistant).toBeVisible();
  await assistant.getByRole('button', { name: '最小化学习智能体' }).click();
  await expect(entryDraft).toHaveValue('未保存词条');
  expect(chatCalls).toBe(0);
});

test('空工作区提供可操作的入门引导，能力问题在本地回答', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/assistant-chat', async (route) => { requests += 1; await route.abort(); });
  await page.goto('/#path');
  await page.getByRole('button', { name: '打开学习智能体' }).click();
  const assistant = page.getByRole('dialog', { name: '学习智能体' });
  const guide = assistant.getByRole('region', { name: '开始使用学习智能体' });
  await assistant.getByText('看看可以做什么', { exact: true }).click();
  await expect(guide.getByRole('button', { name: /记录第一次实践/ })).toBeVisible();
  const question = assistant.getByRole('textbox', { name: '输入问题' });
  await question.fill('你能做什么');
  await question.press('Enter');
  await expect(guide.getByRole('button', { name: /保存一个脚本/ })).toBeVisible();
  await guide.getByRole('button', { name: /保存一个脚本/ }).click();
  await expect(page).toHaveURL(/#path$/);
  await assistant.getByRole('button', { name: '保存脚本', exact: true }).click();
  await expect(assistant.getByRole('form', { name: '保存代码版本' })).toBeVisible();
  expect(requests).toBe(0);
});
