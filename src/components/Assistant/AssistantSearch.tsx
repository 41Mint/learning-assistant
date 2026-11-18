import { searchWords } from '../../utils/resourceSearch';
import { SearchResults } from '../Search/ResourceSearch';
import type { SearchScope } from '../Search/ResourceSearch';

export default function AssistantSearch({ query, scope, onScope, onNavigate }: {
  query: string;
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
  onNavigate: () => void;
}) {
  const words = searchWords(query);
  return <section className="assistant-search" aria-label="查找资料">
    <label className="assistant-search-scope">资料类型
      <select value={scope} onChange={(event) => onScope(event.target.value as SearchScope)}>
        <option value="all">全部</option>
        <option value="knowledge">知识词条</option>
        <option value="history">学习日志</option>
        <option value="code">代码版本</option>
        <option value="path">实践卡片与卡组</option>
      </select>
    </label>
    {words.length > 0 && <SearchResults query={query} words={words} scope={scope} includeSource={false} limit={6}
      onOpen={(newTab) => { if (!newTab) onNavigate(); }} />}
  </section>;
}
