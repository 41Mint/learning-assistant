#!/bin/sh

cd "$(dirname "$0")" || exit 1
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
export PATH

if command -v npm >/dev/null 2>&1; then
  npm run dev:latest
  result=$?
else
  printf '%s\n' '请先安装 Node.js 24，再双击 start.command。'
  result=1
fi

if [ "$result" -ne 0 ]; then
  printf '%s' '按回车关闭窗口。'
  read -r unused
fi
exit "$result"
