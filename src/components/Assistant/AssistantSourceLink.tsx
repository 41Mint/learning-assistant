import { useWorkspaceStore, workspaceResourceTarget } from '../../store/workspaceStore';

export default function AssistantSourceLink({ href, label, onNavigate }: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  return <a href={href} {...workspaceResourceTarget(href)} onClick={(event) => {
    const target = workspaceResourceTarget(href);
    event.currentTarget.target = target.target ?? '';
    event.currentTarget.rel = target.rel ?? '';
    if (!target.target && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      onNavigate();
      if (window.location.hash === href) useWorkspaceStore.getState().syncHash();
    }
  }}>{label}</a>;
}
