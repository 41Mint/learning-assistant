import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { ASSISTANT_CHAT_ENDPOINT, CHAT_ANSWER_LIMIT, CHAT_HISTORY_LIMIT, CHAT_QUESTION_LIMIT } from '../../types/assistantChat';
import type { ChatRequest } from '../../types/assistantChat';
import { LOG_REVIEW_MAX_TEXT, reviewRecord, reviewText } from '../../types/logReview';

export interface AssistantChatSource { id: string; date: string; text: string; draft: boolean }
interface Turn { question: string; answer: string; source?: { id: string; date: string; draft: boolean } }

async function askAssistant(input: ChatRequest, signal: AbortSignal): Promise<string> {
  const response = await fetch(ASSISTANT_CHAT_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const value: unknown = await response.json().catch(() => null);
  const answer = reviewRecord(value) ? reviewText(value.answer, CHAT_ANSWER_LIMIT) : '';
  if (!response.ok || !answer) {
    throw new Error((reviewRecord(value) && reviewText(value.error, 300)) || '暂时无法获取回复，请重试。');
  }
  return answer;
}

export default function AssistantChat({ source, active }: { source?: AssistantChatSource; active: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState(source?.id);
  const [pending, setPending] = useState<Pick<Turn, 'question' | 'source'>>();
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  if (sourceId !== source?.id) {
    setSourceId(source?.id);
    setReference(null);
  }
  const attached = source && sourceId === source.id && reference === source.id && source.text.trim() ? source : undefined;

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (active && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [turns, pending, active]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (controller.current || !question.trim()) return;
    const current = new AbortController();
    controller.current = current;
    setError('');
    const text = question.trim();
    const sourceInfo = attached ? { id: attached.id, date: attached.date, draft: attached.draft } : undefined;
    setPending({ question: text, source: sourceInfo });
    const history = turns.filter((turn) => turn.source?.id === attached?.id)
      .slice(-(CHAT_HISTORY_LIMIT / 2))
      .flatMap(({ question, answer }) => [
        { role: 'user' as const, content: question },
        { role: 'assistant' as const, content: answer },
      ]);
    const log = attached && { date: attached.date, text: attached.text.slice(0, LOG_REVIEW_MAX_TEXT) };
    try {
      const answer = await askAssistant({ question: text, history, log }, current.signal);
      if (current.signal.aborted) return;
      setTurns((previous) => [...previous, { question: text, answer, source: sourceInfo }]);
      setQuestion('');
    } catch (error) {
      if (!current.signal.aborted) setError(error instanceof Error ? error.message : '暂时无法获取回复，请重试。');
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setPending(undefined);
      }
    }
  };
  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    setPending(undefined);
    composer.current?.focus();
  };
  const renderQuestion = (turn: Pick<Turn, 'question' | 'source'>) => <div className="assistant-chat-question">
    {turn.source && <small>引用 {turn.source.date}{turn.source.draft ? ' · 草稿' : ''}</small>}
    <p>{turn.question}</p>
  </div>;
  return <section className="assistant-chat" aria-label="自由问答">
    <div ref={transcript} className="assistant-transcript" role="log" aria-label="问答记录">
      {!turns.length && !pending && <p className="knowledge-muted">问一个学习问题，例如「PPU 是什么？」</p>}
      {turns.map((turn, index) => <div key={index} className="assistant-turn">
        {renderQuestion(turn)}
        <div className="assistant-answer markdown-preview">
          <ReactMarkdown skipHtml disallowedElements={['img', 'a']} unwrapDisallowed>{turn.answer}</ReactMarkdown>
        </div>
      </div>)}
      {pending && <div className="assistant-turn">{renderQuestion(pending)}<p role="status">正在生成回复…</p></div>}
    </div>
    <form className="assistant-composer" aria-label="发送问题" onSubmit={(event) => void send(event)}>
      {source && <label className="assistant-reference">
        <input type="checkbox" checked={Boolean(attached)} disabled={Boolean(pending) || !source.text.trim()}
          onChange={(event) => setReference(event.target.checked ? source.id : null)} />
        引用当前日志 · {source.date}{source.draft ? '（草稿）' : ''}
      </label>}
      {attached && <p className="knowledge-muted">发送时会将引用的{attached.draft ? '草稿' : '日志'}文字交给 DeepSeek。{attached.text.length > LOG_REVIEW_MAX_TEXT && `只发送前 ${LOG_REVIEW_MAX_TEXT} 个字符。`}</p>}
      <textarea ref={composer} aria-label="输入问题" rows={3} maxLength={CHAT_QUESTION_LIMIT} placeholder="输入问题…"
        value={question} readOnly={Boolean(pending)} onChange={(event) => { setQuestion(event.target.value); setError(''); }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }} />
      {error && <p role="alert">{error}</p>}
      <div className="assistant-composer-actions">
        {turns.length > 0 && <button type="button" className="knowledge-text-button" disabled={Boolean(pending)} onClick={() => {
          setTurns([]);
          setError('');
          composer.current?.focus();
        }}>清空对话</button>}
        {pending
          ? <button type="button" className="note-button secondary" onClick={cancel}>停止</button>
          : <button type="submit" className="note-button" disabled={!question.trim()}>发送</button>}
      </div>
    </form>
  </section>;
}
