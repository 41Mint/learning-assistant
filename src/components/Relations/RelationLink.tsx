import type { RelationNodeRef } from '../../types/relations';
import { relationHref } from '../../store/workspaceStore';

export default function RelationLink(subject: RelationNodeRef) {
  return <a className="relation-entry-link" href={relationHref(subject)}>查看关系</a>;
}
