import { useRef, useState } from 'react';
import { removeStorageItem, setStorageItem, STORAGE_KEYS } from '../../utils/storage';

type BackupData = {
  studyLogs: unknown[];
  skillTree: unknown;
  tasks: unknown[];
  currentGoal: unknown;
  streak: unknown;
  settings: unknown;
  pomodoroToday: unknown;
};

interface BackupFile {
  format: 'learning-assistant-backup';
  version: 1;
  exportedAt: string;
  data: BackupData;
}

function readRawStorage(key: string): unknown {
  const value = localStorage.getItem(key);
  if (value === null) return null;
  return JSON.parse(value);
}

function readArrayStorage(key: string): unknown[] {
  const value = readRawStorage(key);
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateBackup(value: unknown): BackupFile | null {
  if (
    !isRecord(value)
    || value.format !== 'learning-assistant-backup'
    || value.version !== 1
    || typeof value.exportedAt !== 'string'
    || !isRecord(value.data)
  ) {
    return null;
  }

  const { data } = value;
  if (!Array.isArray(data.studyLogs) || !Array.isArray(data.tasks)) return null;

  return {
    format: 'learning-assistant-backup',
    version: 1,
    exportedAt: value.exportedAt,
    data: {
      studyLogs: data.studyLogs,
      skillTree: data.skillTree ?? null,
      tasks: data.tasks,
      currentGoal: data.currentGoal ?? null,
      streak: data.streak ?? null,
      settings: data.settings ?? null,
      pomodoroToday: data.pomodoroToday ?? null,
    },
  };
}

function getSummary(backup: BackupFile) {
  const completedSkills = isRecord(backup.data.skillTree) && Array.isArray(backup.data.skillTree.completedIds)
    ? backup.data.skillTree.completedIds.length
    : 0;
  return {
    logs: backup.data.studyLogs.length,
    tasks: backup.data.tasks.length,
    completedSkills,
  };
}

export default function DataBackup() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState('');

  const handleExport = () => {
    const backup: BackupFile = {
      format: 'learning-assistant-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        studyLogs: readArrayStorage(STORAGE_KEYS.STUDY_LOGS),
        skillTree: readRawStorage(STORAGE_KEYS.SKILL_TREE) ?? null,
        tasks: readArrayStorage(STORAGE_KEYS.TASKS),
        currentGoal: readRawStorage(STORAGE_KEYS.CURRENT_GOAL) ?? null,
        streak: readRawStorage(STORAGE_KEYS.STREAK) ?? null,
        settings: readRawStorage(STORAGE_KEYS.SETTINGS) ?? null,
        pomodoroToday: readRawStorage(STORAGE_KEYS.POMODORO_TODAY) ?? null,
      },
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `learning-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('备份文件已下载。请保存在本机或可信的云盘位置。');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = validateBackup(JSON.parse(String(reader.result)));
        if (!backup) throw new Error('invalid backup');
        setPendingBackup(backup);
        setMessage('备份文件验证通过，请确认是否恢复。');
      } catch {
        setPendingBackup(null);
        setMessage('无法识别该备份文件。请选择由学习助手导出的 JSON 文件。');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const restore = () => {
    if (!pendingBackup) return;
    const mappings: Array<[string, unknown]> = [
      [STORAGE_KEYS.STUDY_LOGS, pendingBackup.data.studyLogs],
      [STORAGE_KEYS.SKILL_TREE, pendingBackup.data.skillTree],
      [STORAGE_KEYS.TASKS, pendingBackup.data.tasks],
      [STORAGE_KEYS.CURRENT_GOAL, pendingBackup.data.currentGoal],
      [STORAGE_KEYS.STREAK, pendingBackup.data.streak],
      [STORAGE_KEYS.SETTINGS, pendingBackup.data.settings],
      [STORAGE_KEYS.POMODORO_TODAY, pendingBackup.data.pomodoroToday],
    ];

    mappings.forEach(([key, value]) => {
      if (value === null) removeStorageItem(key);
      else setStorageItem(key, value);
    });
    window.location.reload();
  };

  const summary = pendingBackup ? getSummary(pendingBackup) : null;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">💾 数据备份与恢复</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        备份包含学习日志、技能进度、自定义任务、当前目标和打卡数据。恢复会替换当前浏览器中的对应数据。
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={handleExport} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
          导出完整备份
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
          选择备份文件恢复
        </button>
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleFileChange} className="hidden" />
      </div>

      {message && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300" role="status">{message}</p>}

      {pendingBackup && summary && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-900/20">
          <h3 className="font-semibold text-amber-900 dark:text-amber-100">确认恢复备份</h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            导出时间：{new Date(pendingBackup.exportedAt).toLocaleString()}；包含 {summary.logs} 条日志、{summary.tasks} 个任务、{summary.completedSkills} 个已完成技能节点。
          </p>
          <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">恢复会替换当前数据，建议先导出当前备份。</p>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={restore} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">确认恢复并刷新</button>
            <button type="button" onClick={() => setPendingBackup(null)} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">取消</button>
          </div>
        </div>
      )}
    </section>
  );
}
