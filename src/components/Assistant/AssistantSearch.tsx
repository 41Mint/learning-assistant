import { evidenceLabels } from '../../utils/assistantEvidence';
import type { ResourceAnswer, ResourceQuestionContext } from '../../utils/resourceAnswer';
import { RESOURCE_ANSWER_SOURCE_LIMIT } from '../../types/resourceAnswer';
import type { SearchScope } from '../../utils/resourceSearch';
import { SearchResults } from '../Search/ResourceSearch';
import AssistantSourceLink from './AssistantSourceLink';
import AssistantPractice from './AssistantPractice';

export function AssistantSearchAnswer({ answer, onNavigate }: { answer: ResourceAnswer; onNavigate: () => void }) {
  const { result, sources, filter, recentDates } = answer;
  return <section className="assistant-evidence-panel" aria-label={recentDates ? '最近学习总结' : '资料回答'}>
    {!sources.length && <p>{recentDates ? '还没有可总结的学习日志正文。' : filter ? `「${filter.label}」的筛选结果中没有可引用的摘录。可以调整关键词或资料类型再试。`
      : '没有找到与问题匹配的本地资料摘录。可以调整关键词或资料类型再试。'}</p>}
    {Boolean(recentDates?.length) && <p className="knowledge-muted">总结依据 {recentDates?.join('、')}</p>}
    {sources.length > 0 && filter &&
      <p className="knowledge-muted">参考「{filter.label}」的 {filter.count} 条结果中的 {sources.length} 条摘录</p>}
    {result?.findings.map((finding, index) => {
      const source = sources[finding.source - 1];
      return <div className="assistant-evidence-finding" key={index}>
        <p>{finding.text}</p>
        <blockquote className="knowledge-muted">{finding.quote}</blockquote>
        <ul className="growth-source-list" aria-label={`第 ${index + 1} 条来源`}><li>
          <AssistantSourceLink href={source.href} label={`${evidenceLabels[source.kind]} · ${source.title}`} onNavigate={onNavigate} />
        </li></ul>
      </div>;
    })}
    {result?.missing && <p><strong>资料不足</strong>　{result.missing}</p>}
    {result && !result.findings.length && <ul className="growth-source-list" aria-label="匹配的资料">
      {sources.map((source) => <li key={source.href}>
        <AssistantSourceLink href={source.href} label={`${evidenceLabels[source.kind]} · ${source.title}`} onNavigate={onNavigate} />
      </li>)}
    </ul>}
  </section>;
}

export default function AssistantSearch({ query, scope, context, onQuery, onScope, onNavigate }: {
  query: string;
  scope: SearchScope;
  context: ResourceQuestionContext;
  onQuery: (query: string) => void;
  onScope: (scope: SearchScope) => void;
  onNavigate: () => void;
}) {
  return <section className="assistant-search" aria-label="查找资料">
    <input className="workspace-input" id="assistant-resource-query" autoComplete="off" aria-label="检索关键词"
      placeholder="输入关键词筛选资料" value={query} onChange={(event) => onQuery(event.target.value)} />
    <label className="assistant-search-scope">资料类型
      <select value={scope} onChange={(event) => onScope(event.target.value as SearchScope)}>
        <option value="all">全部</option>
        <option value="knowledge">知识词条</option>
        <option value="history">学习日志</option>
        <option value="code">代码版本</option>
        <option value="path">实践记录</option>
      </select>
    </label>
    <p className="knowledge-muted">{context.filterLabel ? '下方提问使用当前结果。' : '直接提问可查找相关资料。'}发送时会将问题和最多六条摘录交给 DeepSeek。</p>
    {context.filterLabel && <SearchResults query={query} results={context.results} limit={RESOURCE_ANSWER_SOURCE_LIMIT}
      onOpen={(newTab) => { if (!newTab) onNavigate(); }}
      renderPracticeReview={(selection) => <AssistantPractice selection={selection} query={query} onNavigate={onNavigate} />} />}
  </section>;
}
