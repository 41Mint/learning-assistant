import { useState } from 'react';
import { useStudyLogStore } from '../../store/studyLogStore';
import { getTodayDate } from '../../utils/storage';
import { prepareMarkdownImport } from '../../utils/markdownImport';
import type { PreparedImport } from '../../utils/markdownImport';
import { deleteImages, writeImages } from '../../utils/imageStorage';
import MarkdownContent from '../common/MarkdownContent';

export default function MarkdownImport() {
  const [date, setDate] = useState(getTodayDate);
  const [document, setDocument] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const logs = useStudyLogStore((state) => state.logs);
  const appendToDate = useStudyLogStore((state) => state.appendToDate);
  const hasContent = logs.some((log) => log.date === date && log.content.trim() && log.content.trim() !== `### ${date}`);

  const prepare = async () => {
    if (!document) return;
    setBusy(true);
    setMessage('');
    setPrepared(null);
    try {
      const content = await document.text();
      if (!content.trim()) throw new Error('Markdown 文件为空，请选择包含学习内容的文件。');
      const result = await prepareMarkdownImport(content, files);
      setPrepared(result);
      setMessage(result.missing.length ? '仍有图片未匹配，请重新选择配套图片后检查。' : '检查通过，可以保存。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '读取文件失败，请重试。'); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!prepared || prepared.missing.length || !date) return;
    setBusy(true);
    let imagesSaved = false;
    try {
      await writeImages(prepared.images);
      imagesSaved = true;
      appendToDate(date, prepared.content);
      setPrepared(null);
      setMessage(`已保存到 ${date} 的学习记录，共 ${prepared.images.length} 张图片。可在下方“学习历史”选择该日期回看或补充。`);
    } catch (error) {
      if (imagesSaved) await deleteImages(prepared.images.map((image) => image.id)).catch(() => {});
      setMessage(error instanceof Error ? error.message : '保存失败，原有学习记录未更改，请重试。');
    } finally { setBusy(false); }
  };

  return (
    <details className="learning-import">
      <summary>导入图文学习记录（Markdown + 图片）</summary>
      <p>选择整理好的 Markdown 和其引用的配套图片。先检查，再保存；导入不会增加学习时长或打卡。</p>
      <p>已保存的笔记可到 <a href="#history">历史回顾 →</a> 按日期查看和补充。</p>
      <fieldset disabled={busy}>
        <div className="import-fields">
          <label>学习日期<input aria-label="导入学习日期" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label>Markdown 文件<input aria-label="Markdown 文件" type="file" accept=".md,.markdown,text/markdown" onChange={(event) => { setDocument(event.target.files?.[0] ?? null); setPrepared(null); setMessage(''); }} /></label>
          <label>配套图片（可多选）<input aria-label="配套图片" type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setPrepared(null); setMessage(''); }} /></label>
        </div>
        <p>已选择 {files.length} 张图片。图片名称应与笔记中的引用一致。</p>
        <button type="button" className="note-button" disabled={!document || busy} onClick={prepare}>检查并预览</button>
        {message && <p role="status">{message}</p>}
        {prepared && (
          <div>
            <p>文中有 {prepared.localImageCount} 处本地图片引用，已匹配 {prepared.images.length} 张图片。</p>
            {prepared.missing.length > 0 && <ul className="import-errors">{prepared.missing.map((path) => <li key={path}>未匹配：{path}</li>)}</ul>}
            <p>{hasContent ? '该日期已有笔记，保存将追加到末尾，保留原有内容与时长。' : '将保存为该日期的学习笔记，时长由番茄钟独立记录。'}</p>
            <div className="markdown-preview import-preview"><MarkdownContent content={prepared.content} images={prepared.images} /></div>
            <button type="button" className="note-button" disabled={busy || !date || prepared.missing.length > 0} onClick={save}>{hasContent ? '确认追加到该日期' : '保存到该日期'}</button>
            <button type="button" className="note-button secondary" onClick={() => { setPrepared(null); setMessage('已取消，本地记录未更改。'); }}>取消</button>
          </div>
        )}
      </fieldset>
    </details>
  );
}
