import { useState } from 'react';
import type { StudyLog } from '../../types';
import { useStudyLogStore } from '../../store/studyLogStore';
import WorkspaceDialog from '../common/WorkspaceDialog';

export default function TrashLogButton({ log, onMoved }: { log: StudyLog; onMoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const trashLog = useStudyLogStore((state) => state.trashLog);

  return <>
    <button type="button" className="knowledge-text-button danger" onClick={() => setConfirm(true)}>删除日志</button>
    {confirm && <WorkspaceDialog title="删除学习日志" action="移入回收站" destructive onClose={() => setConfirm(false)} onSave={() => {
      trashLog(log.id);
      onMoved();
    }}>
      <p>将 {log.date} 的学习日志移入回收站？可在「数据管理」中恢复正文、图片和关联资料。</p>
    </WorkspaceDialog>}
  </>;
}
