#!/usr/bin/env bash
set -euo pipefail

app_name="lazybb"
out_dir="${HOME}/.local/bin"
out_path="${out_dir}/${app_name}"
profile_marker="# lazybb local bin"
profile_line='export PATH="$HOME/.local/bin:$PATH"'

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required but was not found on PATH." >&2
  exit 1
fi

mkdir -p "$out_dir"

echo "Compiling ${app_name}..."
bun build --compile src/main.tsx --outfile "$app_name"

mv "$app_name" "$out_path"
chmod +x "$out_path"

echo "Installed ${app_name} to ${out_path}"

case ":${PATH}:" in
  *":${out_dir}:"*)
    echo "${out_dir} is already on PATH. Run: ${app_name}"
    exit 0
    ;;
esac

shell_name="$(basename "${SHELL:-}")"
profile_path=""
case "$shell_name" in
  zsh) profile_path="${HOME}/.zshrc" ;;
  bash) profile_path="${HOME}/.bashrc" ;;
  fish)
    echo "${out_dir} is not on PATH. For fish, run: fish_add_path ${out_dir}"
    exit 0
    ;;
  *) profile_path="${HOME}/.profile" ;;
esac

if [ -n "$profile_path" ]; then
  touch "$profile_path"
  if ! grep -Fq "$profile_line" "$profile_path"; then
    {
      echo ""
      echo "$profile_marker"
      echo "$profile_line"
    } >> "$profile_path"
    echo "Added ${out_dir} to PATH in ${profile_path}"
  else
    echo "${out_dir} is already configured in ${profile_path}"
  fi
fi

echo "Reload your shell or run: source ${profile_path}"
echo "Then run: ${app_name}"
