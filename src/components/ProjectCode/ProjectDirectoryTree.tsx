import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { buildProjectDirectoryTree } from '../../utils/projectDirectory';
import type { ProjectDirectoryNode } from '../../utils/projectDirectory';

function DirectoryRow({ node, renderItem }: { node: ProjectDirectoryNode; renderItem: (node: ProjectDirectoryNode) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <li>
    <div className="project-directory-row">
      {node.children && <button type="button" className="project-directory-toggle"
        aria-label={`${expanded ? '折叠' : '展开'} ${node.path}`} aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}>{expanded ? '▾' : '▸'}</button>}
      {renderItem(node)}
    </div>
    {expanded && node.children && <ul>
      {node.children.map((child) => <DirectoryRow key={child.path} node={child} renderItem={renderItem} />)}
    </ul>}
  </li>;
}

export default function ProjectDirectoryTree({ files, renderItem }: {
  files: readonly string[];
  renderItem: (node: ProjectDirectoryNode) => ReactNode;
}) {
  const nodes = useMemo(() => buildProjectDirectoryTree(files), [files]);
  return <div className="project-directory-tree" role="region" aria-label="项目目录树">
    <ul>{nodes.map((node) => <DirectoryRow key={node.path} node={node} renderItem={renderItem} />)}</ul>
  </div>;
}
