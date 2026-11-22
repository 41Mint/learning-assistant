import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const day = '2026-11-04';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfeoAAAAASUVORK5CYII=', 'base64');
const markdown = '# 学习步骤\n\nPPU 笔记\n\n![示意截图](images/step.png)\n\n[文档](https://docs.unity3d.com/)';

async function openImport(page: Page, content = markdown) {
  await page.goto('/');
  await page.getByRole('button', { name: '导入图文学习记录', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '导入图文学习记录', exact: true })).toBeVisible();
  await page.getByLabel('导入学习日期').fill(day);
  await page.getByLabel('Markdown 文件', { exact: true }).setInputFiles({ name: '学习整理.md', mimeType: 'text/markdown', buffer: Buffer.from(content) });
}

async function importNote(page: Page) {
  await openImport(page);
  await page.getByLabel('配套图片', { exact: true }).setInputFiles({ name: 'step.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '检查并预览', exact: true }).click();
  await expect(page.locator('.import-preview img')).toHaveCount(1);
  await page.getByRole('button', { name: '保存到该日期', exact: true }).click();
  await expect(page.getByText(`已保存到 ${day} 的学习记录`, { exact: false })).toBeVisible();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾' }).click();
  await page.getByLabel('定位学习日期').fill(day);
  await expect(page.locator('#study-history .markdown-preview img')).toHaveCount(1);
  await expect.poll(() => page.locator('#study-history .markdown-preview img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
}

function pasteScreenshots(editor: Locator, count = 1) {
  return editor.evaluate((element, { bytes, count }) => {
    element.focus();
    const clipboard = new DataTransfer();
    for (let index = 0; index < count; index++) clipboard.items.add(new File([new Uint8Array(bytes)], `截图-${index + 1}.png`, { type: 'image/png' }));
    return element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
  }, { bytes: [...png], count });
}

function savedImageIds(page: Page) {
  return page.evaluate(async () => {
    const { getImages } = await import('/src/utils/imageStorage.ts');
    return (await getImages()).map(({ id }) => id);
  });
}

test('日志插入菜单可选择多张本地图片，确认后预览并随日志保存', async ({ page }) => {
  await page.goto('/#today');
  const today = page.getByRole('region', { name: '今日学习', exact: true });
  await today.getByRole('button', { name: '编辑', exact: true }).click();
  const editor = today.getByLabel('学习内容（Markdown）');
  await editor.fill('图片前图片后');
  await editor.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 3));
  const panel = today.getByRole('group', { name: '插入到 Markdown' });
  const trigger = today.getByRole('button', { name: '插入', exact: true });
  const file = panel.getByLabel('本地图片（可多选）');
  const insert = panel.getByRole('button', { name: '插入到正文' });
  await trigger.click();
  await panel.getByRole('button', { name: '插入图片', exact: true }).click();
  await expect(file).toBeFocused();
  await file.setInputFiles({ name: '伪装图片.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
  await expect(panel.getByRole('alert')).toContainText('不是支持的');
  await expect(insert).toBeDisabled();
  const images = ['场景.png', 'Inspector.png'].map((name) => ({ name, mimeType: 'image/png', buffer: png }));
  await file.setInputFiles(images);
  await expect(insert).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('图片前图片后');
  expect(await savedImageIds(page)).toEqual([]);

  await trigger.click();
  await panel.getByRole('button', { name: '插入图片', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await file.click();
  await (await chooser).setFiles(images);
  await insert.click();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue(/^图片前\n\n!\[场景\]\(learning-image:[\w-]+\)\n\n!\[Inspector\]\(learning-image:[\w-]+\)\n\n图片后$/);
  await today.getByRole('button', { name: '预览', exact: true }).click();
  const preview = today.getByRole('region', { name: '学习内容预览' });
  await expect(preview.getByRole('img', { name: '场景', exact: true })).toBeVisible();
  await expect(preview.getByRole('img', { name: 'Inspector', exact: true })).toBeVisible();
  expect(await savedImageIds(page)).toEqual([]);
  await today.getByRole('button', { name: '保存记录' }).click();
  await expect(today.getByRole('img', { name: '场景', exact: true })).toBeVisible();
  expect(await savedImageIds(page)).toHaveLength(2);
  await page.reload();
  for (const name of ['场景', 'Inspector']) {
    await expect.poll(() => today.getByRole('img', { name, exact: true }).evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
  }
});

test('历史日志右键插入表格并就地填表，分隔线保留独立块和撤销', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/#today');
  await page.evaluate(async (date) => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    useStudyLogStore.getState().appendToDate(date, '表格前表格后');
  }, day);
  await page.goto('/#history/' + day);
  await page.getByRole('button', { name: '编辑 / 补充记录' }).click();
  const form = page.getByRole('form', { name: '历史记录编辑表单' });
  const editor = form.getByRole('textbox', { name: '历史学习内容', exact: true });
  await editor.fill('表格前表格后');
  await editor.evaluate((field: HTMLTextAreaElement) => field.setSelectionRange(0, 3));
  await editor.click({ button: 'right', position: { x: 28, y: 24 } });
  const panel = form.getByRole('group', { name: '插入到 Markdown' });
  await panel.getByRole('button', { name: '插入表格', exact: true }).click();
  const rows = panel.getByRole('combobox', { name: '正文行数', exact: true });
  await expect(rows).toBeFocused();
  await rows.selectOption('3');
  await panel.getByRole('combobox', { name: '列数', exact: true }).selectOption('4');
  await panel.getByRole('button', { name: '插入到正文' }).click();
  await expect(editor).toBeFocused();
  expect(await editor.evaluate((field: HTMLTextAreaElement) => field.value.slice(field.selectionStart, field.selectionEnd))).toBe('列 1');
  await page.keyboard.insertText('指标');
  const tableOnly = await editor.inputValue();
  expect(tableOnly).toMatch(/^表格前\n\n\| 指标 \| 列 2 \| 列 3 \| 列 4 \|/);
  expect(tableOnly).toMatch(/\n\n表格后$/);

  await editor.evaluate((field: HTMLTextAreaElement) => {
    const offset = field.value.lastIndexOf('表格后');
    field.setSelectionRange(offset, offset);
  });
  const trigger = form.getByRole('button', { name: '插入', exact: true });
  await trigger.click();
  const divider = panel.getByRole('button', { name: '插入分隔线', exact: true });
  await divider.click();
  const withDivider = tableOnly.replace(/表格后$/, '---\n\n表格后');
  await expect(editor).toHaveValue(withDivider);
  await editor.press('Control+z');
  await expect(editor).toHaveValue(tableOnly);
  await trigger.click();
  await divider.click();
  await form.getByRole('button', { name: '预览', exact: true }).click();
  const preview = form.getByRole('region', { name: '历史学习内容预览' });
  const table = preview.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('columnheader')).toHaveText(['指标', '列 2', '列 3', '列 4']);
  await expect(preview.getByRole('separator')).toBeVisible();
  await form.getByRole('button', { name: '保存补充' }).click();
  await page.reload();
  const reading = page.locator('#study-history .markdown-preview:visible');
  await expect(reading.getByRole('table')).toBeVisible();
  await expect(reading.getByRole('separator')).toBeVisible();
});

test('今日编辑可粘贴截图和替换选区，仅保存仍引用的图片且能从备份恢复', async ({ page, browser }) => {
  await page.goto('/#today');
  const today = page.getByRole('region', { name: '今日学习', exact: true });
  const edit = today.getByRole('button', { name: '编辑', exact: true });
  const editor = today.getByLabel('学习内容（Markdown）');
  await edit.click();
  const original = await editor.inputValue();
  await pasteScreenshots(editor);
  const showPreview = today.getByRole('button', { name: '预览', exact: true });
  const showSource = today.getByRole('button', { name: '源码', exact: true });
  await showPreview.click();
  const preview = today.getByRole('region', { name: '学习内容预览' });
  await expect(preview.getByRole('img', { name: '截图', exact: true })).toBeVisible();
  expect(await savedImageIds(page)).toEqual([]);
  await today.getByRole('button', { name: '取消编辑' }).click();
  await edit.click();
  await expect(editor).toHaveValue(original);
  expect(await savedImageIds(page)).toEqual([]);

  await editor.fill('粘贴前\n\n替换这段\n\n粘贴后');
  const textAllowed = await editor.evaluate((element: HTMLTextAreaElement) => {
    const start = element.value.indexOf('替换这段');
    element.setSelectionRange(start, start + '替换这段'.length);
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', '普通文字');
    return element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
  });
  expect(textAllowed).toBe(true);
  expect(await pasteScreenshots(editor, 2)).toBe(false);
  await expect(editor).toHaveValue(/^粘贴前\n\n!\[截图 1\]\(learning-image:[\w-]+\)\n\n!\[截图 2\]\(learning-image:[\w-]+\)\n\n粘贴后$/);
  await expect.poll(() => editor.evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart))).toBe('粘贴后');
  await showPreview.click();
  await expect(preview.getByRole('img')).toHaveCount(2);
  await showSource.click();
  await editor.fill((await editor.inputValue()).replace(/!\[截图 2\]\(learning-image:[\w-]+\)\n\n/, ''));
  await today.getByRole('button', { name: '保存记录' }).click();
  await expect(today.getByRole('img', { name: '截图 1', exact: true })).toBeVisible();
  expect(await savedImageIds(page)).toHaveLength(1);
  await page.reload();
  const image = today.getByRole('img', { name: '截图 1', exact: true });
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);

  await page.goto('/#data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const buffer = await readFile((await (await download).path())!);
  const backup = JSON.parse(buffer.toString('utf8'));
  expect(backup.images).toHaveLength(1);
  expect(backup.images[0].base64).toBe(png.toString('base64'));
  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await restored.goto('/#today');
    await expect(restored.getByRole('region', { name: '今日学习', exact: true }).getByRole('img', { name: '截图 1' })).toBeVisible();
  } finally { await context.close(); }
});

test('历史日志粘贴保存失败时保留正文草稿并回退新图片，可重试', async ({ page }) => {
  await importNote(page);
  const previousImages = await savedImageIds(page);
  await page.getByRole('button', { name: '编辑 / 补充记录' }).click();
  const form = page.getByRole('form', { name: '历史记录编辑表单' });
  const editor = form.getByRole('textbox', { name: '历史学习内容', exact: true });
  await editor.press('Control+End');
  await pasteScreenshots(editor, 2);
  await form.getByRole('button', { name: '预览', exact: true }).click();
  await expect(form.getByRole('region', { name: '历史学习内容预览' }).getByRole('img', { name: /^截图/ })).toHaveCount(2);
  await form.getByRole('button', { name: '源码', exact: true }).click();
  const draft = await editor.inputValue();
  const save = form.getByRole('button', { name: '保存补充' });
  await page.evaluate(() => {
    const storedPut = IDBObjectStore.prototype.put;
    let puts = 0;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof storedPut>) {
      if (this.name === 'images' && ++puts === 2) {
        IDBObjectStore.prototype.put = storedPut;
        throw new Error('测试图片写入失败');
      }
      return storedPut.apply(this, args);
    };
  });
  await save.click();
  await expect(form.getByRole('alert')).toContainText('测试图片写入失败');
  expect(await savedImageIds(page)).toEqual(previousImages);
  await expect(editor).toHaveValue(draft);
  await page.evaluate(() => {
    const storedPut = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'learning-assistant:study-logs') {
        Storage.prototype.setItem = storedPut;
        throw new Error('测试日志写入失败');
      }
      storedPut.call(this, key, value);
    };
  });
  await save.click();
  await expect(form.getByRole('alert')).toContainText('测试日志写入失败');
  expect(await savedImageIds(page)).toEqual(previousImages);
  await expect(editor).toHaveValue(draft);
  await save.click();
  await expect(form).toHaveCount(0);
  await expect(page.locator('#study-history').getByRole('img', { name: /^截图/ })).toHaveCount(2);
  expect(await savedImageIds(page)).toHaveLength(3);
});

test('大截图保存后稳定显示，单击切换尺寸，双击打开原图详情', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#today');
  const today = page.getByRole('region', { name: '今日学习', exact: true });
  await today.getByRole('button', { name: '编辑', exact: true }).click();
  const editor = today.getByRole('textbox', { name: '学习内容（Markdown）', exact: true });
  await editor.fill('大尺寸截图');
  await editor.evaluate(async (element) => {
    const canvas = document.createElement('canvas');
    canvas.width = 3840;
    canvas.height = 2400;
    const drawing = canvas.getContext('2d')!;
    drawing.fillStyle = '#315c8a';
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    const clipboard = new DataTransfer();
    clipboard.items.add(new File([blob!], '大截图.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
  });
  await today.getByRole('button', { name: '预览', exact: true }).click();
  const previewImage = today.getByRole('region', { name: '学习内容预览' }).getByRole('img', { name: '截图' });
  await expect(previewImage).toBeVisible();
  await expect.poll(() => previewImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(3840);
  const thumbnail = (await previewImage.boundingBox())!;
  expect(thumbnail.height).toBeLessThanOrEqual(180);
  expect(thumbnail.width / thumbnail.height).toBeCloseTo(3840 / 2400, 1);
  await expect(previewImage.locator('..')).toHaveAttribute('href', /^blob:/);
  await today.getByRole('button', { name: '源码', exact: true }).click();
  await editor.fill(await editor.inputValue() + '\n\n' + '截图后的学习记录。\n\n'.repeat(16));
  await today.getByRole('button', { name: '保存记录' }).click();
  const expand = today.getByRole('button', { name: '展开全文', exact: true });
  await expect(expand).toBeVisible();
  const reading = today.locator('.collapsible-note');
  const stable = await reading.evaluate((note) => new Promise<boolean>((resolve) => {
    let frames = 0;
    const image = note.querySelector('img');
    const src = image?.src;
    const sample = () => {
      if (!image || note.querySelector('img') !== image || image.src !== src) return resolve(false);
      if (++frames === 24) return resolve(image.naturalWidth === 3840);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  expect(stable).toBe(true);
  const image = reading.getByRole('img', { name: '截图' });
  const original = await image.elementHandle();
  const thumbnailHeight = (await image.boundingBox())!.height;
  expect(thumbnailHeight).toBeLessThanOrEqual(160);
  const resize = reading.getByRole('button', { name: '切换图片尺寸 · 截图', exact: true });
  await resize.click();
  await expect(resize).toHaveAttribute('aria-pressed', 'true');
  expect((await image.boundingBox())!.height).toBeGreaterThan(thumbnailHeight);
  await expect(today.getByRole('button', { name: '收起正文', exact: true })).toBeVisible();
  await resize.dblclick();
  const detail = page.getByRole('dialog', { name: '图片详情' });
  await expect(detail.getByText('3840 × 2400 像素')).toBeVisible();
  await expect(detail.getByRole('link', { name: '在新标签页打开原图' })).toHaveAttribute('href', /^blob:/);
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(resize).toHaveAttribute('aria-pressed', 'true');
  await resize.click();
  await expect(resize).toHaveAttribute('aria-pressed', 'false');
  await today.getByRole('button', { name: '收起正文', exact: true }).click();
  await expect(expand).toBeVisible();
  expect(await image.evaluate((element, first) => element === first, original)).toBe(true);
});

test('缺图阻止保存；代码块里的图片语法不当作实际图片', async ({ page }) => {
  await openImport(page, `${markdown}\n\n\x60\x60\x60md\n![code](missing-code.png)\n\x60\x60\x60`);
  await page.getByRole('button', { name: '检查并预览', exact: true }).click();
  await expect(page.getByText('未匹配：images/step.png', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存到该日期', exact: true })).toBeDisabled();
  await expect(page.locator('.import-errors li')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '导入图文学习记录' })).toBeHidden();
  await expect(page.getByRole('button', { name: '导入图文学习记录' })).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:study-logs') ?? '[]').some((log: { date: string }) => log.date === '2026-11-04'))).toBe(false);
});

test('图片刷新后可读；历史补充及追加不覆盖旧正文和时长，今日计时独立', async ({ page }) => {
  await importNote(page);
  await page.reload();
  await page.getByLabel('定位学习日期').fill(day);
  await expect.poll(() => page.locator('#study-history .markdown-preview img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  const editor = page.getByLabel('历史学习内容', { exact: true });
  await editor.fill(`${await editor.inputValue()}\n\n补充：32×32 素材的新例子。`);
  await page.getByRole('button', { name: '保存补充', exact: true }).click();
  await expect(page.locator('#study-history')).toContainText('补充：32×32 素材的新例子。');
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const store = useStudyLogStore.getState();
    const log = store.getLogByDate('2026-11-04');
    store.saveLog({ ...log, duration: 50 });
    store.addDuration(25, '目标：今日任务');
  });
  const history = page.locator('#study-history');
  const trigger = history.getByRole('button', { name: '导入图文学习记录', exact: true });
  const dialog = page.getByRole('dialog', { name: '导入图文学习记录' });
  await trigger.click();
  await expect(dialog.getByLabel('导入学习日期')).toHaveValue(day);
  await dialog.getByLabel('Markdown 文件', { exact: true }).setInputFiles({
    name: '补充.md', mimeType: 'text/markdown', buffer: Buffer.from('第二次学习内容'),
  });
  await dialog.getByRole('button', { name: '检查并预览' }).click();
  await dialog.getByRole('button', { name: '确认追加到该日期' }).click();
  await expect(history.getByRole('status')).toHaveText(`已保存到 ${day} 的学习记录，共 0 张图片。`);
  await expect(trigger).toBeFocused();
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('learning-assistant:study-logs') ?? '[]'));
  const historical = logs.find((log: { date: string }) => log.date === day);
  expect(historical.duration).toBe(50);
  expect(historical.content).toContain('补充：32×32');
  expect(historical.content).toContain('第二次学习内容');
  expect(logs.find((log: { tags: string[] }) => log.tags.includes('目标：今日任务')).duration).toBe(25);
  await page.reload();
  await page.getByLabel('定位学习日期').fill(day);
  await expect(page.locator('#study-history')).toContainText('第二次学习内容');
});

test('今日和历史的导入按钮与正文左对齐，历史可在空白日期创建图文日志', async ({ page }) => {
  await page.goto('/#today');
  const today = page.getByRole('region', { name: '今日学习', exact: true });
  const buttonName = '导入图文学习记录';
  const todayTrigger = today.getByRole('button', { name: buttonName, exact: true });
  await expect(todayTrigger).toBeVisible();
  expect((await todayTrigger.boundingBox())?.x).toBe((await today.locator('.history-content').boundingBox())?.x);

  await page.goto(`/#history/${day}`);
  const history = page.locator('#study-history');
  const historyTrigger = history.getByRole('button', { name: buttonName, exact: true });
  await expect(history.getByText('该日期暂无学习记录。')).toBeVisible();
  await historyTrigger.click();
  const dialog = page.getByRole('dialog', { name: buttonName });
  await expect(dialog.getByLabel('导入学习日期')).toHaveValue(day);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(historyTrigger).toBeFocused();

  const otherDate = '2026-11-03';
  await historyTrigger.click();
  await dialog.getByLabel('导入学习日期').fill(otherDate);
  await dialog.getByLabel('Markdown 文件', { exact: true }).setInputFiles({
    name: '学习整理.md', mimeType: 'text/markdown', buffer: Buffer.from(markdown),
  });
  await dialog.getByLabel('配套图片', { exact: true }).setInputFiles({ name: 'step.png', mimeType: 'image/png', buffer: png });
  await dialog.getByRole('button', { name: '检查并预览' }).click();
  await dialog.getByRole('button', { name: '保存到该日期' }).click();
  await expect(page).toHaveURL(new RegExp(`#history/${otherDate}$`));
  await expect(history.getByLabel('定位学习日期')).toHaveValue(otherDate);
  await expect(historyTrigger).toBeFocused();
  const body = history.locator('.history-content');
  await expect(body.getByRole('img', { name: '示意截图' })).toBeVisible();
  expect((await historyTrigger.boundingBox())?.x).toBe((await body.boundingBox())?.x);
});

test('新版备份包含真实图片；取消无写入；确认恢复后图文一致', async ({ page }) => {
  await importNote(page);
  await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const log = useStudyLogStore.getState().getLogByDate('2026-11-04');
    useKnowledgeStore.getState().saveEntry({ title: 'PPU 图示', aliases: [], category: '2D 素材', content: log.content }, { fromLog: { id: log.id, note: '原始截图' } });
  });
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '数据管理' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  const download = await downloadEvent;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.version).toBe(9);
  expect(backup.data.knowledge.entries).toHaveLength(1);
  expect(backup.images).toHaveLength(1);
  expect(Buffer.from(backup.images[0].base64, 'base64').equals(png)).toBe(true);
  const file = { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) };
  await page.getByLabel('选择备份文件', { exact: true }).setInputFiles(file);
  const before = await page.evaluate(() => localStorage.getItem('learning-assistant:study-logs'));
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('learning-assistant:study-logs'))).toBe(before);
  await page.evaluate(async () => {
    const { writeImages } = await import('/src/utils/imageStorage.ts');
    await writeImages([], true);
    localStorage.setItem('learning-assistant:study-logs', '[]');
    localStorage.setItem('learning-assistant:log:2000-01-01', JSON.stringify({ duration: 500 }));
  });
  await page.getByLabel('选择备份文件', { exact: true }).setInputFiles(file);
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: '确认恢复并刷新', exact: true }).click(),
  ]);
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾' }).click();
  await page.getByLabel('定位学习日期').fill(day);
  await page.locator('#study-history .markdown-preview img').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('#study-history .markdown-preview img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('learning-assistant:log:2000-01-01'))).toBeNull();
  await page.locator('#study-history').getByRole('link', { name: 'PPU 图示', exact: true }).click();
  await page.locator('.knowledge-entry-content img').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.knowledge-entry-content img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('旧备份可读取，损坏备份无写入，写入失败可回退', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { createBackup, parseBackup, restoreBackup } = await import('/src/utils/dataBackup.ts');
    const backup = await createBackup();
    const old = parseBackup({ ...backup, version: 1, images: undefined });
    const before = localStorage.getItem('learning-assistant:study-logs');
    let rejected = false;
    try { parseBackup({ ...backup, data: { ...backup.data, studyLogs: [{}] } }); } catch { rejected = true; }
    const original = Storage.prototype.setItem;
    let failedOnce = false;
    Storage.prototype.setItem = function (key, value) {
      if (!failedOnce && key === 'learning-assistant:study-logs') { failedOnce = true; throw new DOMException('quota', 'QuotaExceededError'); }
      return original.call(this, key, value);
    };
    let rolledBack = false;
    try { await restoreBackup(backup); } catch { rolledBack = true; }
    finally { Storage.prototype.setItem = original; }
    return { oldVersion: old.version, rejected, rolledBack, unchanged: before === localStorage.getItem('learning-assistant:study-logs') };
  });
  expect(result).toEqual({ oldVersion: 1, rejected: true, rolledBack: true, unchanged: true });
});

test('历史日志可从备份中的回收站恢复图文和关联，同日有记录时可改日期', async ({ page, browser }) => {
  await importNote(page);
  const { logId, entryId, versionId } = await page.evaluate(async (date) => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const { useGrowthStore } = await import('/src/store/growthStore.ts');
    const study = useStudyLogStore.getState();
    const log = study.getLogByDate(date);
    study.saveLog({ ...log, tags: ['Unity'], duration: 25 });
    const entryId = useKnowledgeStore.getState().saveEntry({ title: '像素图示', aliases: [], category: '', content: '' }, { fromLog: { id: log.id, note: '原始截图' } });
    const versionId = await useProjectCodeStore.getState().saveVersion({
      project: { name: '示例项目', repositoryUrl: '', tutorialUrl: '' }, path: 'Sprite.cs', content: 'class Sprite {}', githubUrl: '', note: '',
    }, { kind: 'log', id: log.id });
    useGrowthStore.getState().savePractice({ id: 'pixel-practice', title: '像素实践', domains: ['Unity'] },
      { id: 'first-practice', date, note: '', logIds: [log.id], entryIds: [] });
    return { logId: log.id, entryId, versionId };
  }, day);
  const deleteLog = page.getByRole('dialog', { name: '删除学习日志' });
  await page.getByRole('button', { name: '删除日志', exact: true }).click();
  await deleteLog.getByRole('button', { name: '取消' }).click();
  await expect(page.getByRole('img', { name: '示意截图' })).toBeVisible();
  await page.getByRole('button', { name: '删除日志', exact: true }).click();
  await deleteLog.getByRole('button', { name: '移入回收站' }).click();
  await expect(page.getByText('日志已移入回收站。')).toBeVisible();
  await expect(page.getByRole('img', { name: '示意截图' })).toHaveCount(0);
  await page.getByRole('button', { name: '检索资料', exact: true }).click();
  const search = page.getByRole('dialog', { name: '检索资料' });
  await search.getByRole('searchbox').fill('学习步骤');
  await expect(search.getByRole('link', { name: /学习步骤/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: '回收站' }).click();
  const trash = page.getByRole('region', { name: '回收站' });
  await expect(trash.getByText(/学习步骤/)).toBeVisible();
  await page.reload();
  await expect(trash.getByText(/学习步骤/)).toBeVisible();
  await page.evaluate(async (id) => {
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    useKnowledgeStore.getState().saveEntry({ title: '像素图示已补充', aliases: [], category: '', content: '' }, { id });
  }, entryId);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const backup = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(backup.data.studyLogs.some(({ id }: { id: string }) => id === logId)).toBe(false);
  expect(backup.data.trashedLogs).toEqual([expect.objectContaining({ id: logId, date: day, duration: 25, tags: ['Unity'], deletedAt: expect.any(Number) })]);
  expect(backup.images).toHaveLength(1);
  expect(backup.data.knowledge.logLinks).toEqual([expect.objectContaining({ entryId, logId })]);

  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('/#data');
    await restored.getByLabel('选择备份文件').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await expect(restored.getByText('回收站中有 1 篇日志。')).toBeVisible();
    await Promise.all([restored.waitForEvent('load'), restored.getByRole('button', { name: '确认恢复并刷新' }).click()]);
    await restored.getByRole('region', { name: '回收站' }).getByText(/学习步骤/).waitFor();
    await restored.evaluate(async (date) => {
      const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
      useStudyLogStore.getState().appendToDate(date, '同日新写的日志');
    }, day);
    await restored.getByRole('button', { name: '恢复日志' }).click();
    const dialog = restored.getByRole('dialog', { name: '恢复学习日志' });
    const restoreDate = dialog.getByLabel('恢复到日期');
    await restoreDate.fill(day);
    await expect(dialog.getByRole('button', { name: '确认恢复' })).toBeDisabled();
    const newDate = '2026-11-03';
    await restoreDate.fill(newDate);
    await dialog.getByRole('button', { name: '确认恢复' }).click();
    await restored.getByRole('region', { name: '回收站' }).getByRole('link', { name: newDate }).click();
    const history = restored.locator('#study-history');
    const image = history.getByRole('img', { name: '示意截图' });
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(history.getByRole('link', { name: '像素图示已补充', exact: true })).toBeVisible();
    await restored.goto('/#code/' + versionId);
    await expect(restored.getByRole('region', { name: '引用记录' }).getByRole('link', { name: /学习步骤/ })).toHaveAttribute('href', '#history/' + newDate);
    await restored.goto('/#path/pixel-practice');
    await expect(restored.getByRole('link', { name: /学习步骤/ })).toHaveAttribute('href', '#history/' + newDate);
    await restored.goto('/#history/' + day);
    await expect(history.getByText('同日新写的日志')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('今日日志可移出并恢复到原日期，刷新不会自动创建冲突日志', async ({ page }) => {
  await page.goto('/#today');
  const today = page.getByRole('region', { name: '今日学习' });
  const logId = await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const log = useStudyLogStore.getState().getTodayLog();
    useStudyLogStore.getState().saveLog({ ...log, content: '今天整理的内容' });
    return log.id;
  });
  await today.getByRole('button', { name: '删除日志' }).click();
  await page.getByRole('dialog', { name: '删除学习日志' }).getByRole('button', { name: '移入回收站' }).click();
  await page.reload();
  await expect(today.getByRole('button', { name: '写日志' })).toBeVisible();
  for (const text of ['', '这份草稿要取消。']) {
    await today.getByRole('button', { name: '写日志' }).click();
    const editor = today.getByRole('form', { name: '今日记录编辑表单' });
    await expect(editor.getByRole('button', { name: '保存记录' })).toBeDisabled();
    if (text) await editor.getByLabel('学习内容（Markdown）').fill(text);
    await editor.getByRole('button', { name: '取消编辑' }).click();
    await expect(today.getByRole('button', { name: '写日志' })).toBeVisible();
    await expect(today.getByRole('button', { name: '删除日志' })).toHaveCount(0);
  }
  await today.getByRole('link', { name: '回收站' }).click();
  await expect(page.getByRole('region', { name: '回收站' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: '恢复日志' }).click();
  const dialog = page.getByRole('dialog', { name: '恢复学习日志' });
  await expect(dialog.getByLabel('恢复到日期')).toHaveCount(0);
  await dialog.getByRole('button', { name: '确认恢复' }).click();
  await expect(page.getByText('回收站为空。')).toBeVisible();
  await page.goto('/#today');
  await expect(today.getByText('今天整理的内容')).toBeVisible();
  expect(await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    return useStudyLogStore.getState().currentLog?.id;
  })).toBe(logId);
  await today.getByRole('button', { name: '删除日志' }).click();
  await page.getByRole('dialog', { name: '删除学习日志' }).getByRole('button', { name: '移入回收站' }).click();
  await today.getByRole('button', { name: '写日志' }).click();
  await today.getByLabel('学习内容（Markdown）').fill('这篇新日志只在保存后写入。');
  await today.getByRole('button', { name: '保存记录' }).click();
  await expect(today.getByText('这篇新日志只在保存后写入。')).toBeVisible();
  expect(await page.evaluate(async () => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    return useStudyLogStore.getState().trashedLogs.map(({ id }) => id);
  })).toEqual([logId]);
});

test('回收站彻底删除只移除该日志、链接和独占图片，写入失败后可重试', async ({ page }) => {
  await importNote(page);
  const { logId, sharedImage, codeId } = await page.evaluate(async (date) => {
    const { useStudyLogStore } = await import('/src/store/studyLogStore.ts');
    const { useKnowledgeStore } = await import('/src/store/knowledgeStore.ts');
    const { useProjectCodeStore } = await import('/src/store/projectCodeStore.ts');
    const { useGrowthStore } = await import('/src/store/growthStore.ts');
    const { getImages, writeImages } = await import('/src/utils/imageStorage.ts');
    const study = useStudyLogStore.getState();
    const log = study.getLogByDate(date);
    const [shared] = await getImages();
    await writeImages([{ ...shared, id: 'private-log-image' }]);
    useKnowledgeStore.getState().saveEntry({ title: '共用图片词条', aliases: [], category: '', content: log.content }, { fromLog: { id: log.id, note: '' } });
    study.saveLog({ ...log, content: log.content + '\n\n![独占图片](learning-image:private-log-image)' });
    const codeId = await useProjectCodeStore.getState().saveVersion({
      project: { name: '示例项目', repositoryUrl: '', tutorialUrl: '' }, path: 'Sprite.cs', content: 'class Sprite {}', githubUrl: '', note: '',
    }, { kind: 'log', id: log.id });
    const growth = useGrowthStore.getState();
    growth.savePractice({ id: 'test-practice', title: '像素实践', domains: ['Unity'] },
      { id: 'practice', date, note: '', logIds: [log.id], entryIds: [] });
    growth.saveExercise({ id: 'test-exercise', title: '像素练习', domains: ['Unity'], action: '练习', done: '',
      sources: { logIds: [log.id], entryIds: [], codeVersionIds: [] } });
    study.trashLog(log.id);
    localStorage.setItem('learning-assistant:log:' + date, JSON.stringify({ content: '旧版副本', duration: 0 }));
    return { logId: log.id, sharedImage: shared.id, codeId };
  }, day);
  await page.goto('/#data');
  const trash = page.getByRole('region', { name: '回收站' });
  const firstPosition = (await trash.boundingBox())!.y;
  expect(firstPosition).toBeLessThan((await page.getByRole('heading', { name: /数据备份与恢复/ }).boundingBox())!.y);
  const remove = page.getByRole('dialog', { name: '彻底删除学习日志' });
  await trash.getByRole('button', { name: '彻底删除' }).click();
  await expect(remove.getByRole('button', { name: '取消' })).toBeFocused();
  await remove.getByRole('button', { name: '取消' }).click();
  await expect(trash.getByRole('button', { name: '恢复日志' })).toBeVisible();
  const before = await page.evaluate(async () => {
    const { createBackup } = await import('/src/utils/dataBackup.ts');
    const { data, images } = await createBackup();
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'learning-assistant:study-logs') {
        Storage.prototype.setItem = original;
        throw new Error('模拟存储失败');
      }
      return original.call(this, key, value);
    };
    return { data, images };
  });
  await trash.getByRole('button', { name: '彻底删除' }).click();
  await remove.getByRole('button', { name: '确认彻底删除' }).click();
  await expect(remove.getByRole('alert')).toContainText('模拟存储失败');
  const failed = await page.evaluate(async () => {
    const { createBackup } = await import('/src/utils/dataBackup.ts');
    const { data, images } = await createBackup();
    return { data, images };
  });
  expect(failed).toEqual(before);
  await remove.getByRole('button', { name: '确认彻底删除' }).click();
  await expect(trash.getByRole('status')).toHaveText('日志已彻底删除。');
  const backup = await page.evaluate(async () => {
    const { createBackup } = await import('/src/utils/dataBackup.ts');
    return createBackup();
  });
  expect(backup.data.trashedLogs).toEqual([]);
  expect(backup.data.studyLogs.some(({ id }: { id: string }) => id === logId)).toBe(false);
  expect(backup.images.map(({ id }: { id: string }) => id)).toEqual([sharedImage]);
  expect(backup.data.knowledge.entries).toHaveLength(1);
  expect(backup.data.knowledge.logLinks).toEqual([]);
  expect(backup.data.projectCode.versions[0].id).toBe(codeId);
  expect(backup.data.projectCode.links).toEqual([]);
  expect(backup.data.growth.outcomes[0].practices[0].logIds).toEqual([]);
  expect(backup.data.growth.exercises[0].sources.logIds).toEqual([]);
  await page.reload();
  await page.goto('/#history/' + day);
  await expect(page.getByText('该日期暂无学习记录。')).toBeVisible();
});

test('Day1 真实材料：15 张图片的导入、刷新和备份', async ({ page }, testInfo) => {
  const source = process.env.DAY1_NOTE;
  test.skip(!source, '设置 DAY1_NOTE 后使用本机真实学习材料验证，不把个人材料放入仓库。');
  const directory = path.dirname(source!);
  const files = (await readdir(path.join(directory, 'images'))).map((name) => path.join(directory, 'images', name));
  const markdown = await readFile(source!, 'utf8');
  await openImport(page, markdown);
  await page.getByLabel('配套图片', { exact: true }).setInputFiles(files);
  await page.getByRole('button', { name: '检查并预览', exact: true }).click();
  await expect(page.locator('.import-preview img')).toHaveCount(15);
  await page.locator('.learning-import').screenshot({ path: testInfo.outputPath('day1-import.png') });
  await page.getByRole('button', { name: '保存到该日期', exact: true }).click();
  await page.reload();
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('link', { name: '历史回顾' }).click();
  await page.getByLabel('定位学习日期').fill(day);
  await page.getByRole('button', { name: '展开全文', exact: true }).click();
  await expect(page.locator('#study-history .markdown-preview img')).toHaveCount(15);
  for (const image of await page.locator('#study-history .markdown-preview img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await expect.poll(() => page.locator('#study-history .markdown-preview img').evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  const heading = [...markdown.matchAll(/^#{1,6} +([\p{Letter}\p{Number}]{3,})[ \t]*\r?$/gmu)].at(-1)?.[1];
  if (heading) {
    await page.getByRole('button', { name: '收起正文', exact: true }).click();
    await page.getByRole('button', { name: '检索资料', exact: true }).click();
    const search = page.getByRole('dialog', { name: '检索资料' });
    await search.getByRole('searchbox').fill(heading);
    await search.getByRole('link', { name: new RegExp(day) }).click();
    await expect(page.locator('#study-history .markdown-preview .search-match').first()).toBeInViewport({ ratio: 1 });
  }
  const counts = await page.evaluate(async () => {
    const { createBackup } = await import('/src/utils/dataBackup.ts');
    const backup = await createBackup();
    return { images: backup.images.length, references: backup.data.studyLogs.find((log) => log.date === '2026-11-04')!.content.match(/learning-image:/g)?.length };
  });
  expect(counts).toEqual({ images: 15, references: 15 });
  await page.getByLabel('定位学习日期').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('day1-history.png') });
});
