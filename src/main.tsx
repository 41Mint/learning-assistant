import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IS_KNOWLEDGE_DEMO } from './utils/workspaceMode'

const root = createRoot(document.getElementById('root')!)
const renderApp = () => root.render(<StrictMode><App /></StrictMode>)

if (IS_KNOWLEDGE_DEMO) {
  root.render(<p role="status">正在准备知识网络演示数据…</p>)
  void import('./data/knowledgeDemo').then(({ prepareKnowledgeDemo }) => prepareKnowledgeDemo()).then(renderApp).catch((error: unknown) => {
    root.render(<section className="module-card">
      <p role="alert">{error instanceof Error ? error.message : '演示数据加载失败。'}</p>
      <a href={window.location.pathname + '#network'}>返回个人知识网络</a>
    </section>)
  })
} else renderApp()
