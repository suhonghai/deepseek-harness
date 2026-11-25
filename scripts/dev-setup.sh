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
  local dir="$home/profiles/desktop"

  mkdir -p "$dir"
  for file in package.json cordis.patch.yml cordis.yml pnpm-workspace.yaml; do
    if [ -f "$dir/$file" ] && ! cmp -s "$template_dir/$file" "$dir/$file"; then
      cp "$dir/$file" "$dir/$file.bak"
      echo "  $label: 已备份 $file -> $file.bak"
    fi
    cp "$template_dir/$file" "$dir/$file"
  done
  echo "  $label: profile 基线已装到 $dir"
}

echo "自媒体工作台 · profile 基线安装"
echo "  模板: $template_dir"

installed=0

if [ "$mode" != "packaged" ]; then
  dev_home="$repo_root/apps/desktop/.desktop-dev/home"
  if [ -d "$dev_home" ]; then
    install_profile "$dev_home" "开发态"
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
  echo "  ⚠ 未找到 MINIMAX_API_KEY,也没有根 .env —— 模型调用会失败。"
  echo "    在仓库根建 .env:  MINIMAX_API_KEY=<key>"
fi

echo ""
echo "完成。下一步: pnpm run start:desktop"
