import type { compareKnowledgeModules } from '../../utils/knowledgeNetwork';
import { relationLabel, relationNodeKey, RELATION_KIND_LABELS } from '../../utils/relations';
import type { RelationConnection, RelationNode } from '../../utils/relations';

export default function ModuleComparisonDetails({ comparison, onConnection, onNode }: {
  comparison: ReturnType<typeof compareKnowledgeModules>;
  onConnection: (connection: RelationConnection) => void;
  onNode: (node: RelationNode) => void;
}) {
  return <section className="network-comparison" aria-label="跨模块关联结果">
    <h3>跨模块关联</h3>
    <h4>直接跨模块连线（{comparison.directCount}）</h4>
    {comparison.groups.length ? <div className="network-evidence-groups">
      {comparison.groups.map(({ categories, connections }) => <details key={JSON.stringify(categories)} open={comparison.groups.length === 1 || undefined}>
        <summary>{categories.map((category) => category || '未分类').join(' ↔ ')}（{connections.length}）</summary>
        <ul className="network-evidence-list">
          {connections.map((connection) => {
            const [left, right] = connection.first.detail === categories[0]
              ? [connection.first, connection.second] : [connection.second, connection.first];
            return <li key={connection.key}><button type="button" onClick={() => onConnection(connection)}>
              <strong>{left.title} ↔ {right.title}</strong><small>{relationLabel(connection)}</small>
            </button></li>;
          })}
        </ul>
      </details>)}
    </div> : <p className="relation-muted">当前可见模块之间暂无直接连线。</p>}
    <h4>共同关联资料（{comparison.shared.length}）</h4>
    {comparison.shared.length ? <ul className="network-evidence-list">
      {comparison.shared.map(({ node, modules }) => <li key={relationNodeKey(node)}>
        <button type="button" onClick={() => onNode(node)}>
          <strong>{node.title}</strong>
          <small>{RELATION_KIND_LABELS[node.kind]} · {modules.map(({ category, links }) => `${category || '未分类'}（${links.length}）`).join(' · ')}</small>
        </button>
      </li>)}
    </ul> : <p className="relation-muted">当前图层中暂无多个可见模块共同关联的日志或代码。</p>}
  </section>;
}
