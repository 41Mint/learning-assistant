import { useRef, useState } from 'react';
import { createBackup, parseBackup, restoreBackup } from '../../utils/dataBackup';
import type { BackupFile } from '../../utils/dataBackup';
import { usePomodoroStore } from '../../store/pomodoroStore';

export default function DataBackup() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleExport = async () => {
    setBusy(true);
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `learning-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`备份已下载，包含 ${backup.data.studyLogs.length} 条日志和 ${backup.images.length} 张图片。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '导出失败，请重试。'); }
    finally { setBusy(false); }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPendingBackup(null);
    setBusy(true);
    try {
      setPendingBackup(parseBackup(JSON.parse(await file.text())));
      setMessage('备份文件检查通过，请核对摘要后确认是否恢复。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法读取备份文件。'); }
    finally { setBusy(false); }
  };

  const restore = async () => {
    if (!pendingBackup) return;
    setBusy(true);
    usePomodoroStore.getState().pauseTimer();
    try {
      await restoreBackup(pendingBackup);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '恢复失败，请重试。'); setBusy(false); }
  };

  const skills = pendingBackup?.data.skillTree?.completedIds;
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">💾 数据备份与恢复</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">备份包含学习日志、导入的图片、技能进度、自定义任务、当前目标和打卡数据。恢复会替换当前浏览器中的对应数据。</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={handleExport} className="note-button">{busy ? '处理中…' : '导出完整备份'}</button>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="note-button secondary">选择备份文件恢复</button>
        <input ref={inputRef} aria-label="选择备份文件" type="file" accept="application/json,.json" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>
      {message && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300" role="status">{message}</p>}
      {pendingBackup && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-900/20">
          <h3 className="font-semibold text-amber-900 dark:text-amber-100">确认恢复备份</h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">导出时间：{new Date(pendingBackup.exportedAt).toLocaleString()}；包含 {pendingBackup.data.studyLogs.length} 条日志、{pendingBackup.data.tasks.length} 个任务、{Array.isArray(skills) ? skills.length : 0} 个已完成技能节点、{pendingBackup.images.length} 张图片。</p>
          <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">恢复会替换当前数据（包括图片），建议先导出当前备份。旧版备份没有图片。</p>
          <div className="mt-3 flex gap-3">
            <button type="button" disabled={busy} onClick={restore} className="note-button" style={{ backgroundColor: '#dc2626' }}>确认恢复并刷新</button>
            <button type="button" disabled={busy} onClick={() => { setPendingBackup(null); setMessage('已取消恢复，当前数据未更改。'); }} className="note-button secondary">取消</button>
          </div>
        </div>
      )}
    </section>
  );
}
