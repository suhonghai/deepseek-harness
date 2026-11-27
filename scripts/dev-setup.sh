#!/usr/bin/env bash
#
# 装/恢复 profile 基线到 DSH_HOME。
#
# 用途:换机器、误删 ~/.dsh、或者想恢复「自媒体工作台」的精简界面配置。
# profile 的 cordis.patch.yml 装着默认模型、模型目录、界面偏好和入口删减清单,
# 这些东西不在仓库的正常开发路径上(仓库在 DSH_HOME 之外),所以单独版本化一份基线。
#
# 用法:
#   bash scripts/dev-setup.sh              # 装到检测到的所有目标
#   bash scripts/dev-setup.sh --packaged  # 只装打包态 (~/.dsh)
#   bash scripts/dev-setup.sh --dev       # 只装开发态 (apps/desktop/.desktop-dev/home)
#
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
template_dir="$repo_root/profiles/desktop"

mode="all"
case "${1:-}" in
  --packaged) mode="packaged" ;;
  --dev) mode="dev" ;;
  "") mode="all" ;;
  *) echo "用法: $0 [--packaged|--dev]" >&2; exit 2 ;;
esac

install_profile() {
  local home="$1"
  local label="$2"
  local profile_name="${3:-desktop}"
  local dir="$home/profiles/$profile_name"

  mkdir -p "$dir"
  for file in package.json cordis.patch.yml cordis.yml pnpm-workspace.yaml; do
    if [ -f "$dir/$file" ] && ! cmp -s "$template_dir/$file" "$dir/$file"; then
      cp "$dir/$file" "$dir/$file.bak"
      echo "  $label: 已备份 $file -> $file.bak"
    fi
    cp "$template_dir/$file" "$dir/$file"
  done
  link_workbench "$dir" "$label"
  echo "  $label: profile 基线已装到 $dir"
}

# bundle 名的解析是双锚点的:先从 dsh installation,再从 profile 目录。
# 工作台包不在 desktop-host 的依赖闭包里,所以必须在 profile 的 node_modules
# 里放一个指向工作区包的软链,否则 bundle 解析会静默失败。
link_workbench() {
  local dir="$1"
  local label="$2"
  local package_dir="$repo_root/packages/experimental/workbench"
  [ -d "$package_dir" ] || return 0
  local scope="$dir/node_modules/@deepseek-ai"
  mkdir -p "$scope"
  ln -sfn "$package_dir" "$scope/dsh-workbench"
  echo "  $label: 已链接 $scope/dsh-workbench -> $package_dir"
}

echo "自媒体工作台 · profile 基线安装"
echo "  模板: $template_dir"

installed=0

# 显式指定 DSH_HOME 时,只装那一个 home —— 桌面端与 web 端各用一个 home,
# 否则它们会抢同一个会话的写锁(会话被占用)。
if [ -n "${DSH_HOME:-}" ]; then
  install_profile "$DSH_HOME" "指定 home"
  install_profile "$DSH_HOME" "指定 home" "workbench-web"
  installed=1
elif [ "$mode" != "packaged" ]; then
  dev_home="$repo_root/apps/desktop/.desktop-dev/home"
  if [ -d "$dev_home" ]; then
    install_profile "$dev_home" "desktop 开发态"
    # web 端验证用的 profile:与 desktop 同一套 bundles 与删减,只换 profile 名。
    # 它同样必须同步,否则模板里的改动(例如 provider 的 baseURL)不会生效。
    install_profile "$dev_home" "web 开发态" "workbench-web"
    installed=1
  elif [ "$mode" = "dev" ]; then
    echo "  开发态: 尚未初始化(先跑一次 pnpm run start:desktop),跳过" >&2
  fi
fi

if [ "$mode" != "dev" ]; then
  packaged_home="${DSH_HOME:-$HOME/.dsh}"
  if [ "$packaged_home" != "$repo_root/apps/desktop/.desktop-dev/home" ]; then
    install_profile "$packaged_home" "打包态"
    installed=1
  fi
fi

if [ "$installed" -eq 0 ]; then
  echo "  没有可安装的目标" >&2
  exit 1
fi

# 凭据不进版本控制,单独提醒。
if [ -z "${MINIMAX_API_KEY:-}" ] && [ ! -f "$repo_root/.env" ]; then
  echo ""
  echo "  ⚠ 环境变量里没有 MINIMAX_API_KEY,根目录也没有 .env。"
  echo "    不过凭据可以走托管文档:$DSH_HOME/.credentials.yaml 的 refs 段,"
  echo "    由 DSH 按请求解析(见 profiles/desktop/cordis.patch.yml 的 apiKeyEnv)。"
fi

echo ""
echo "完成。下一步: pnpm run start:desktop"
