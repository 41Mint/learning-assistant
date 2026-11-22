import { expect, test } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

test('Day 03 实际日志保留截图，在 Input Direction 旁预览并定位 Update()', async ({ page }) => {
  const source = process.env.DAY3_NOTE;
  test.skip(!source, '设置 DAY3_NOTE 使用本机 Day 03 整理稿，不将个人材料存入仓库。');
  const markdown = (await readFile(source!, 'utf8')).replace(/\r\n/g, '\n');
  const script = markdown.match(/^\x60{3}(?:csharp|cs)\n([\s\S]+?)\n\x60{3}$/m)?.[1];
  expect(script).toContain('class PlayerController');
  const lines = script!.split('\n');
  const start = lines.findIndex((line) => line.includes('void Update()')) + 1;
  expect(start).toBeGreaterThan(0);
  const images = path.join(path.dirname(source!), 'images');

  await page.goto('/#history/2026-11-19');
  const history = page.locator('#study-history');
  await history.getByRole('button', { name: '导入图文学习记录', exact: true }).click();
  const importer = page.getByRole('dialog', { name: '导入图文学习记录', exact: true });
  await importer.getByLabel('Markdown 文件', { exact: true }).setInputFiles(source!);
  await importer.getByLabel('配套图片', { exact: true }).setInputFiles((await readdir(images)).map((name) => path.join(images, name)));
  await importer.getByRole('button', { name: '检查并预览' }).click();
  await expect(importer.locator('.import-preview img')).toHaveCount(15);
  await importer.getByRole('button', { name: '保存到该日期' }).click();

  const attachments = history.getByRole('region', { name: '项目代码', exact: true });
  await attachments.getByText('项目代码（0）', { exact: true }).click();
  await attachments.getByRole('button', { name: '添加代码版本', exact: true }).click();
  const version = attachments.getByRole('form', { name: '保存代码版本' });
  await version.getByLabel('项目名称').fill('Adventure using URP');
  await version.getByLabel('本地 .cs 文件').setInputFiles({ name: 'PlayerController.cs', mimeType: 'text/plain', buffer: Buffer.from(script!) });
  await version.getByLabel('项目内路径（可选）').fill('Assets/Scripts/Player/PlayerController.cs');
  await version.getByLabel('版本说明（可选）').fill('Day 03：读取 Gameplay/Move');
  await version.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(attachments.getByRole('link', { name: /PlayerController\.cs/ })).toBeVisible();
  await history.getByRole('button', { name: '编辑 / 补充记录', exact: true }).click();
  const editor = history.getByRole('form', { name: '历史记录编辑表单' });
  const body = editor.getByLabel('历史学习内容', { exact: true });
  // Only change the isolated browser copy; remove the duplicated full script, then cite Update beside the image.
  const text = (await body.inputValue()).replace(/^\x60{3}(?:csharp|cs)\n[\s\S]+?\n\x60{3}$/m, '');
  const imageLine = /^!\[Player Controller 组件中的 Input Direction X\/Y\].*$/m.exec(text);
  expect(imageLine).not.toBeNull();
  const position = imageLine!.index + imageLine![0].length;
  await body.fill(text.slice(0, position) + '\n\n' + text.slice(position));
  await body.evaluate((node: HTMLTextAreaElement, offset) => node.setSelectionRange(offset, offset), position + 2);
  await editor.getByRole('button', { name: '插入', exact: true }).click();
  await editor.getByRole('button', { name: '引用项目代码' }).click();
  await editor.getByRole('combobox', { name: '引用代码版本' }).fill('PlayerController');
  await editor.getByRole('option', { name: /PlayerController\.cs/ }).click();
  await editor.getByLabel('链接文字（可选）').fill('查看 Update()');
  await editor.getByLabel('起始行（可选）').fill(String(start));
  await editor.getByLabel('结束行（可选）').fill(String(start + 3));
  await editor.getByRole('button', { name: '插入到正文' }).click();
  await editor.getByRole('button', { name: '保存补充' }).click();

  await expect(editor).toBeHidden();
  const expand = history.getByRole('button', { name: '展开全文', exact: true });
  if (await expand.isVisible()) await expand.click();
  await expect(history.locator('.markdown-preview img')).toHaveCount(15);
  for (const caption of ['Input Direction X/Y', 'Linear Velocity']) {
    await history.getByRole('button', { name: new RegExp(`查看原图 · .*${caption}`) }).click();
    const viewer = page.getByRole('dialog', { name: '图片详情' });
    const image = viewer.getByRole('img', { name: new RegExp(caption) });
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await viewer.getByRole('button', { name: '关闭图片详情' }).click();
  }
  const ref = history.getByRole('link', { name: '查看 Update()', exact: true });
  await ref.hover();
  await expect(page.getByRole('tooltip')).toContainText('ReadValue<Vector2>()');
  await ref.click();
  const selected = page.locator('.script-preview [data-code-cited]');
  await expect(selected).toHaveCount(4);
  await expect(selected.nth(2)).toContainText('ReadValue<Vector2>()');
  await expect(selected.first()).toBeInViewport();
});
