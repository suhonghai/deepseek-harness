#!/usr/bin/env bash
# 自媒体工作台插件的自动化验证。
#
# 覆盖不依赖模型凭据的全部层级：类型、lint、单元测试、Typert 契约、
# Web 端面板渲染。每个检查独立跑完并汇报,任何一项失败即整体失败。
#
# 用法:
#   bash scripts/verify-workbench.sh          # 自动起 web 端并验证
#   bash scripts/verify-workbench.sh --no-web # 跳过 Web 端检查
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
declare -a RESULTS=()

# 跑一个检查,把输出写进临时文件,只在失败时打印细节。
run_check() {
  local name="$1"; shift
  local log; log="$(mktemp)"
  printf '  %-46s' "$name"
  if "$@" > "$log" 2>&1; then
    printf '\033[32mPASS\033[0m\n'
    PASS=$((PASS+1))
    RESULTS+=("PASS  $name")
  else
    printf '\033[31mFAIL\033[0m\n'
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL  $name")
    echo "     ---- 失败输出(末尾 25 行)----"
    tail -25 "$log" | sed 's/^/     /'
    echo "     --------------------------------"
  fi
  rm -f "$log"
}

echo "=== 自媒体工作台验证 ==="
echo

# ---------------------------------------------------------------- 静态检查
echo "[1/4] 静态检查"

run_check "workbench host 类型检查" \
  node_modules/.bin/tsc -p packages/experimental/workbench/tsconfig.host.json --noEmit

run_check "workbench client 类型检查" \
  node_modules/.bin/tsc -p packages/experimental/workbench/tsconfig.client.json --noEmit

run_check "workbench lint (src + tests)" \
  node_modules/.bin/oxlint packages/experimental/workbench/src/ packages/experimental/workbench/tests/

# ---------------------------------------------------------------- 单元测试
echo
echo "[2/4] 单元测试"

run_check "草稿域 / 投影 / 文章库 / 工具包测试" \
  node --import tsx/esm node_modules/vitest/vitest.mjs run packages/experimental/workbench/tests/ packages/experimental/tool-articles/tests/ packages/experimental/tool-prompt-draft/tests/

# ---------------------------------------------------------------- Remote 契约
echo
echo "[3/4] Remote 契约"

check_contract() {
  # articles 与 promptDrafts 两个命名空间都必须出现在生成的客户端契约里,
  # 且不能含与 RemoteNamespaceService 保留成员冲突的方法名。
  local d="packages/experimental/workbench/lib/typert.remote-client.d.ts"
  if [ ! -f "$d" ]; then
    echo "契约产物不存在: $d (先跑 node --import tsx/esm scripts/generate-typert.ts)"
    return 1
  fi
  local missing=0
  for ns in articles promptDrafts; do
    grep -q "'$ns'" "$d" || { echo "契约缺少命名空间: $ns"; missing=1; }
  done
  for bad in "articles/remove" "articles/ctx" "articles/empty" "articles/name"; do
    if grep -q "'$bad'" "$d"; then echo "契约含冲突方法名: $bad"; missing=1; fi
  done
  return $missing
}

run_check "Typert 契约含两个命名空间且无冲突方法" check_contract

# ---------------------------------------------------------------- Web 端
echo
echo "[4/4] Web 端渲染"

if [ "${1:-}" = "--no-web" ]; then
  printf '  %-46s\033[33mSKIP\033[0m (--no-web)\n' "面板渲染与 console 检查"
  SKIP=$((SKIP+1))
  RESULTS+=("SKIP  Web 端面板渲染")
else
  web_check() {
    # 用独立端口起一个自己的实例:token 只在启动时打印到 stdout,
    # 已运行的服务拿不到它的 token,所以这里不复用外部实例。
    local port=5171
    local home="$ROOT/apps/desktop/.desktop-dev/home"
    local log=/tmp/wb-verify-web.log
    local script=/tmp/wb-verify-panel.mjs

    echo "启动临时 web 端(端口 $port,profile: workbench-web)..."
    DSH_HOME="$home" node apps/cli/lib/bin.js --profile workbench-web --port $port --no-open > "$log" 2>&1 &
    local server_pid=$!
    # 服务退出时(无论成败)都收尾。
    trap 'kill '"$server_pid"' 2>/dev/null || true' RETURN

    local waited=0 token=""
    until [ -n "$token" ]; do
      token="$(grep -o 'token=[A-Za-z0-9_-]*' "$log" 2>/dev/null | head -1 | cut -d= -f2)"
      if [ -z "$token" ]; then
        if ! kill -0 $server_pid 2>/dev/null; then
          echo "web 端启动即退出,日志:"; tail -15 "$log" | sed 's/^/     /'
          return 1
        fi
        sleep 1; waited=$((waited+1))
        [ $waited -gt 90 ] && { echo "web 端启动超时(90s)"; return 1; }
      fi
    done
    sleep 3

    cat > "$script" <<'MJS'
import { globSync } from 'node:fs'
import { createRequire } from 'node:module'
const root = process.env.WB_ROOT
const pw = globSync(`${root}/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js`)[0]
const { chromium } = createRequire(pw)(pw)
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 200)))
await page.goto(process.argv[2], { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
for (const label of ['继续', 'Continue', '知道了', '跳过']) {
  const btn = page.getByRole('button', { name: label, exact: true })
  if (await btn.count() > 0) { try { await btn.first().click({ timeout: 3000, force: true }); break } catch {} }
}
const entry = page.getByText('工作台', { exact: true })
if (await entry.count() === 0) { console.error('侧栏没有「工作台」入口'); await browser.close(); process.exit(1) }
await entry.first().click()
await page.waitForTimeout(1800)
const body = await page.locator('body').innerText()
const must = ['生成提示词', '文章', '素材', '发布']
const missing = must.filter(t => !body.includes(t))
if (missing.length) { console.error('面板缺少区块:', missing.join(', ')); await browser.close(); process.exit(1) }
if (errors.length) { console.error('console 有错误:\n' + errors.slice(0, 5).join('\n')); await browser.close(); process.exit(1) }
console.log('面板四块面齐全,console 零错误')
await browser.close()
MJS

    local out rc
    out="$(WB_ROOT="$ROOT" node "$script" "http://127.0.0.1:$port/?token=$token" 2>&1)"
    rc=$?
    echo "$out" | sed 's/^/     /'
    return $rc
  }

  run_check "web 端:侧栏入口 + 面板四块面 + 零 console 错误" web_check
fi

# ---------------------------------------------------------------- 汇总
echo
echo "=== 汇总 ==="
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo
echo "PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
[ $FAIL -eq 0 ] && { echo "\033[32m全部通过\033[0m"; exit 0; } || { echo "\033[31m有失败项\033[0m"; exit 1; }
