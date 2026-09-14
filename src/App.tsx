import Pomodoro from './components/Pomodoro/Pomodoro';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🎮 游戏开发学习助手
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            保持学习动力，记录成长轨迹
          </p>
        </header>

        {/* 番茄钟 */}
        <section className="mb-8">
          <Pomodoro />
        </section>

        {/* 占位区域 - 后续功能 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 学习统计
            </h2>
            <p className="text-gray-500 dark:text-gray-400">即将推出...</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🔥 连续学习
            </h2>
            <p className="text-gray-500 dark:text-gray-400">即将推出...</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
