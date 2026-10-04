#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd -- "$SCRIPT_DIR"

# MiKTeX was previously invoked from this installation with an explicit path.
MIKTEX_BIN="/d/Program Files/MiKTeX/miktex/bin/x64"
XELATEX="$MIKTEX_BIN/xelatex.exe"
BIBTEX="$MIKTEX_BIN/bibtex.exe"

for executable in "$XELATEX" "$BIBTEX"; do
    if [[ ! -x "$executable" ]]; then
        printf 'ERROR: Không tìm thấy executable: %s\n' "$executable" >&2
        exit 1
    fi
done

# MiKTeX fails when PATH contains the file D:\LDPlayer\LDPlayer9\adb.exe.
# Remove only that malformed entry for this process; the system PATH is unchanged.
declare -a cleaned_path=()
IFS=: read -r -a path_entries <<< "${PATH:-}"
for path_entry in "${path_entries[@]}"; do
    case "${path_entry,,}" in
        */ldplayer/ldplayer9/adb.exe|d:\\ldplayer\\ldplayer9\\adb.exe)
            continue
            ;;
    esac
    cleaned_path+=("$path_entry")
done
if ((${#cleaned_path[@]} > 0)); then
    IFS=:
    PATH="${cleaned_path[*]}"
    unset IFS
    export PATH
fi

xelatex_args=(-interaction=nonstopmode -file-line-error -jobname=main main.tex)
"$XELATEX" "${xelatex_args[@]}"
"$BIBTEX" main
"$XELATEX" "${xelatex_args[@]}"
"$XELATEX" "${xelatex_args[@]}"

printf 'Đã biên dịch xong: %s/main.pdf\n' "$SCRIPT_DIR"
