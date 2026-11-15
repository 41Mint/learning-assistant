interface TaskFieldsProps {
  title: string;
  description: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
}

export default function TaskFields({ title, description, onTitle, onDescription }: TaskFieldsProps) {
  return <>
    <label className="growth-field">
      任务名称
      <input autoFocus value={title} placeholder="添加一个可执行任务" onChange={(event) => onTitle(event.target.value)} />
    </label>
    <label className="growth-field">
      任务说明
      <textarea rows={3} value={description} placeholder="补充说明（可选）" onChange={(event) => onDescription(event.target.value)} />
    </label>
  </>;
}
