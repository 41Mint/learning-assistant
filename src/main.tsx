import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IS_TEST_WORKSPACE } from './utils/workspaceMode'

const root = createRoot(document.getElementById('root')!)
const renderApp = () => root.render(<StrictMode><App /></StrictMode>)

if (IS_TEST_WORKSPACE) {
  root.render(<p role="status">正在准备测试工作区…</p>)
  void import('./data/knowledgeDemo').then(({ prepareTestWorkspace }) => prepareTestWorkspace()).then(renderApp).catch((error: unknown) => {
    root.render(<section className="module-card">
      <p role="alert">{error instanceof Error ? error.message : '测试工作区加载失败。'}</p>
      <a href={window.location.pathname + '#today'}>返回个人工作区</a>
    </section>)
  })
} else renderApp()
