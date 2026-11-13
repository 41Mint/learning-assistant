import { searchWords } from '../../utils/resourceSearch';
import { SearchResults } from '../Search/ResourceSearch';
import type { SearchScope } from '../Search/ResourceSearch';

export default function AssistantSearch({ query, scope, onQuery, onScope, onNavigate }: {
  query: string;
  scope: SearchScope;
  onQuery: (query: string) => void;
  onScope: (scope: SearchScope) => void;
  onNavigate: () => void;
}) {
  const words = searchWords(query);
  return <section className="assistant-search" aria-label="查找资料">
    <label htmlFor="assistant-search-query">检索关键词</label>
    <input id="assistant-search-query" className="search-input" type="search" value={query}
      placeholder="例如 PPU、Tilemap、InputManager.cs" onChange={(event) => onQuery(event.target.value)} />
    <label className="assistant-search-scope">资料类型
      <select value={scope} onChange={(event) => onScope(event.target.value as SearchScope)}>
        <option value="all">全部</option>
        <option value="knowledge">知识词条</option>
        <option value="history">学习日志</option>
        <option value="code">代码版本</option>
      </select>
    </label>
    {words.length > 0 && <SearchResults query={query} words={words} scope={scope} includeSource={false} limit={6}
      onOpen={(newTab) => { if (!newTab) onNavigate(); }} />}
  </section>;
}
