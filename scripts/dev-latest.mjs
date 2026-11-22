import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 5185;
const branch = 'master';
const repository = 'https://github.com/41Mint/learning-assistant.git';
const remoteRef = `refs/remotes/origin/${branch}`;
const npm = process.env.npm_execpath;

function run(command, args, capture = false, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const action = command === process.execPath ? `npm ${args[1]}` : `${command} ${args[0]}`;
    throw new Error(`${action} 执行失败。`);
  }
  return result.stdout?.trim();
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => socket.destroy());
    server.once('error', (error) => reject(error.code === 'EADDRINUSE'
      ? new Error(`端口 ${port} 正在使用，请先关闭原来的开发服务。`)
      : error));
    server.listen(port, 'localhost', () => resolve(server));
  });
}

let portGuard;

function startFromArchive() {
  const checkout = join(root, 'learning-assistant-local');
  if (!existsSync(checkout)) {
    console.log('正在建立可自动更新的项目副本…');
    run('git', ['clone', '--branch', branch, '--single-branch', repository, checkout]);
  }
  if (!existsSync(join(checkout, '.git')) ||
      run('git', ['config', '--get', 'remote.origin.url'], true, checkout) !== repository) {
    throw new Error('已有的 learning-assistant-local 不是本项目的更新副本，请从新的解压目录运行。');
  }
  run(process.execPath, [npm, 'run', 'dev:latest'], false, checkout);
}

async function start() {
  if (!npm) throw new Error('请通过 npm run dev:latest 启动。');
  if (!existsSync(join(root, '.git'))) {
    startFromArchive();
    return;
  }
  if (run('git', ['branch', '--show-current'], true) !== branch) throw new Error(`请在 ${branch} 分支运行自动更新。`);
  if (run('git', ['status', '--porcelain', '--untracked-files=no'], true)) {
    throw new Error('项目有未提交的修改，请先处理这些修改再更新。');
  }
  portGuard = await reservePort();

  console.log('正在同步 GitHub 版本…');
  run('git', ['fetch', 'origin', `refs/heads/${branch}:${remoteRef}`]);
  const latest = run('git', ['rev-parse', '--verify', remoteRef], true);
  run('git', ['merge', '--ff-only', '--no-overwrite-ignore', latest]);
  if (run('git', ['rev-parse', 'HEAD'], true) !== latest) {
    throw new Error('本地有尚未同步到 origin 的提交，请先处理这些提交再更新。');
  }

  const lock = run('git', ['rev-parse', 'HEAD:package-lock.json'], true);
  const dependencies = `${lock}\n${process.platform} ${process.arch} ${process.version}\n`;
  const stamp = join(root, 'node_modules', '.learning-assistant-dependencies');
  if (!existsSync(join(root, 'node_modules', 'vite', 'package.json')) ||
      !existsSync(stamp) || readFileSync(stamp, 'utf8') !== dependencies) {
    console.log('正在安装当前版本的依赖…');
    run(process.execPath, [npm, 'ci', '--include=dev', '--no-audit', '--no-fund']);
    writeFileSync(stamp, dependencies);
  }

  await new Promise((resolve) => portGuard.close(resolve));
  console.log(`当前版本 ${latest.slice(0, 7)}，正在启动 http://localhost:${port}…`);
  run(process.execPath, [npm, 'run', 'dev', '--', '--port', String(port), '--strictPort', '--open']);
}

try {
  await start();
} catch (error) {
  const message = error.code === 'ENOENT' && error.path === 'git' ? '请先安装 Git。' : error.message;
  console.error(`启动失败。 ${message}`);
  process.exitCode = 1;
} finally {
  if (portGuard?.listening) portGuard.close();
}
