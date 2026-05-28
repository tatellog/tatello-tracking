#!/usr/bin/env bash
#
# scripts/visual-diff.sh
#
# Refactor safety net (Paso 3) — capture and diff iOS-simulator
# screenshots of LunarConstellation states before/after each phase
# of the strangler-fig refactor.
#
# WHAT THIS CATCHES
#   Catastrophic visual regressions: the canvas went black, the
#   constellation moved off-frame, a layer disappeared, the counter
#   chip shifted. With the default 5% tolerance these are very
#   visible in the diff PNG.
#
# WHAT THIS DOES NOT CATCH
#   Animation timing differences (twinkle phase, breath cascade
#   offset, shooting-star position). These vary frame-to-frame in
#   the running animation; pixel-perfect diff is mathematically
#   impossible without freezing the worklets, which would change
#   the very behaviour we want to validate. For exact structural
#   regressions, the Jest snapshot tests under
#   features/tabs/components/__tests__/LunarConstellation.test.tsx
#   are the authoritative gate (Reanimated mocked → deterministic
#   tree → 100% bit comparison).
#
# WORKFLOW
#   1. Boot the iOS simulator and launch the app (`pnpm start` →
#      press `i`).
#   2. Navigate to /refactor-test/<state-id>.
#   3. Wait ~2 seconds so the canvas-ready reveal completes and the
#      animations settle into their natural cycle.
#   4. Run `scripts/visual-diff.sh capture baseline <state-id>`
#      BEFORE starting the refactor. Repeat for every state ID you
#      care about (or use `capture-all`).
#   5. After a refactor phase, repeat steps 2-3 and run
#      `scripts/visual-diff.sh capture current <state-id>`.
#   6. Run `scripts/visual-diff.sh diff` to see the diff %.
#
# REQUIREMENTS
#   • macOS with Xcode command-line tools (for `xcrun simctl`)
#   • ImageMagick (`brew install imagemagick`) for `diff` mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIFF_ROOT="$SCRIPT_DIR/visual-diff"
BASELINE_DIR="$DIFF_ROOT/baseline"
CURRENT_DIR="$DIFF_ROOT/current"
DIFF_DIR="$DIFF_ROOT/diff"
TOLERANCE_PCT="${VISUAL_DIFF_TOLERANCE_PCT:-5}"

mkdir -p "$BASELINE_DIR" "$CURRENT_DIR" "$DIFF_DIR"

usage() {
  cat <<EOF
visual-diff · Refactor safety net for LunarConstellation

Usage:
  scripts/visual-diff.sh capture <baseline|current> <state-id>
    Take a screenshot of the currently-booted iOS simulator and
    save it as <state-id>.png inside baseline/ or current/. You are
    responsible for navigating to /refactor-test/<state-id> first
    and waiting for the reveal to settle (~2 s).

  scripts/visual-diff.sh capture-all <baseline|current>
    Iterate every state ID under features/tabs/components/__fixtures__/
    and prompt you to navigate before each capture.

  scripts/visual-diff.sh diff [state-id]
    Compare baseline/ vs current/ using ImageMagick. Without an
    ID, runs every matching pair. Writes side-by-side diff PNGs
    to diff/. Pass threshold: \$VISUAL_DIFF_TOLERANCE_PCT (default 5%).
    Exit code 0 = all under threshold, 1 = at least one over.

  scripts/visual-diff.sh list
    List capture state IDs found in baseline/ and current/.

  scripts/visual-diff.sh clean <baseline|current|diff|all>
    Delete the contents of one or all folders.

Env:
  VISUAL_DIFF_TOLERANCE_PCT   Pass threshold in % (default 5)
EOF
}

require_imagemagick() {
  if ! command -v compare >/dev/null 2>&1; then
    echo "ERROR: ImageMagick 'compare' not found. Install with: brew install imagemagick" >&2
    exit 2
  fi
}

require_simctl() {
  if ! command -v xcrun >/dev/null 2>&1; then
    echo "ERROR: xcrun not found. Install Xcode command-line tools." >&2
    exit 2
  fi
  if ! xcrun simctl list devices booted | grep -q "Booted"; then
    echo "ERROR: no booted iOS simulator. Open Simulator + launch the app first." >&2
    exit 2
  fi
}

# Read the canonical list of state IDs from the fixture file. Single
# source of truth — match the IDs used by the test + the screen.
list_state_ids() {
  local fixture="$SCRIPT_DIR/../features/tabs/components/__fixtures__/lunar-constellation-states.ts"
  if [ ! -f "$fixture" ]; then
    echo "ERROR: fixture file missing: $fixture" >&2
    exit 2
  fi
  # Signs × states declared in arrays — keep this regex in sync with
  # the fixture file's literal shape.
  local signs=(aries tauro geminis cancer leo virgo libra escorpio sagitario capricornio acuario piscis)
  local states=(empty partial halfway complete)
  for sign in "${signs[@]}"; do
    for state in "${states[@]}"; do
      echo "${sign}-${state}"
    done
  done
}

cmd_capture() {
  require_simctl
  local kind="${1:-}"
  local state_id="${2:-}"
  case "$kind" in
    baseline|current) ;;
    *) echo "ERROR: capture kind must be 'baseline' or 'current'" >&2; usage; exit 1;;
  esac
  if [ -z "$state_id" ]; then
    echo "ERROR: state-id required" >&2; usage; exit 1
  fi

  local dest_dir="$DIFF_ROOT/$kind"
  mkdir -p "$dest_dir"
  local dest="$dest_dir/${state_id}.png"
  xcrun simctl io booted screenshot "$dest"
  echo "captured: $dest"
}

cmd_capture_all() {
  require_simctl
  local kind="${1:-}"
  case "$kind" in
    baseline|current) ;;
    *) echo "ERROR: capture-all kind must be 'baseline' or 'current'" >&2; exit 1;;
  esac

  local dest_dir="$DIFF_ROOT/$kind"
  mkdir -p "$dest_dir"

  while IFS= read -r state_id; do
    printf "Navega a /refactor-test/%s en Expo Go, espera ~2 s, y presiona ENTER (o 'q' para salir): " "$state_id"
    read -r ans
    if [ "$ans" = "q" ]; then
      echo "abortado por el usuario"
      exit 0
    fi
    local dest="$dest_dir/${state_id}.png"
    xcrun simctl io booted screenshot "$dest"
    echo "✓ ${state_id}.png"
  done < <(list_state_ids)
}

# Compare a single pair. Echo "<state>\t<%>\t<status>".
compare_pair() {
  local state_id="$1"
  local base="$BASELINE_DIR/${state_id}.png"
  local curr="$CURRENT_DIR/${state_id}.png"
  local out="$DIFF_DIR/${state_id}.png"

  if [ ! -f "$base" ] || [ ! -f "$curr" ]; then
    printf "%s\tN/A\tMISSING\n" "$state_id"
    return 0
  fi

  # AE metric = number of pixels different above the fuzz threshold.
  # Use a small per-pixel fuzz (2%) to ignore JPEG-ish rounding;
  # the macro tolerance is applied later as a percentage of total.
  local pixels diff_pct status total
  # imagemagick's compare writes the diff image to stdout-ish via the
  # `out` arg and prints the metric to stderr. We capture stderr.
  pixels=$(compare -metric AE -fuzz 2% "$base" "$curr" "$out" 2>&1 || true)
  # If sizes differ, AE returns inf or an error. Treat as 100%.
  if ! [[ "$pixels" =~ ^[0-9]+$ ]]; then
    printf "%s\t100.00\tSIZE_OR_FORMAT_DIFFERS\n" "$state_id"
    return 0
  fi

  total=$(identify -format "%[fx:w*h]" "$base")
  diff_pct=$(awk -v p="$pixels" -v t="$total" 'BEGIN { printf "%.2f", (p/t)*100 }')

  # awk-based comparison (avoid bc dependency)
  if awk -v a="$diff_pct" -v b="$TOLERANCE_PCT" 'BEGIN { exit (a > b) }'; then
    status="PASS"
  else
    status="FAIL"
  fi
  printf "%s\t%s\t%s\n" "$state_id" "$diff_pct" "$status"
}

cmd_diff() {
  require_imagemagick
  local only="${1:-}"
  local any_fail=0
  printf "STATE\tDIFF_%%\tSTATUS\n"
  if [ -n "$only" ]; then
    local line; line=$(compare_pair "$only")
    echo "$line"
    [[ "$line" == *FAIL* ]] && any_fail=1
  else
    while IFS= read -r state_id; do
      local line; line=$(compare_pair "$state_id")
      echo "$line"
      [[ "$line" == *FAIL* ]] && any_fail=1
    done < <(list_state_ids)
  fi
  if [ "$any_fail" -eq 1 ]; then
    echo ""
    echo "→ Hay diffs sobre el umbral de ${TOLERANCE_PCT}%. Revisa diff/*.png."
    exit 1
  fi
  echo ""
  echo "→ Todos los diffs bajo el umbral de ${TOLERANCE_PCT}%."
}

cmd_list() {
  echo "Baseline:"
  ls -1 "$BASELINE_DIR" 2>/dev/null | sed 's/^/  /' || echo "  (vacío)"
  echo "Current:"
  ls -1 "$CURRENT_DIR" 2>/dev/null | sed 's/^/  /' || echo "  (vacío)"
}

cmd_clean() {
  local target="${1:-}"
  case "$target" in
    baseline) rm -rf "$BASELINE_DIR"/* 2>/dev/null || true; echo "baseline limpiado";;
    current)  rm -rf "$CURRENT_DIR"/*  2>/dev/null || true; echo "current limpiado";;
    diff)     rm -rf "$DIFF_DIR"/*     2>/dev/null || true; echo "diff limpiado";;
    all)
      rm -rf "$BASELINE_DIR"/* "$CURRENT_DIR"/* "$DIFF_DIR"/* 2>/dev/null || true
      echo "todo limpiado"
      ;;
    *) echo "ERROR: clean target must be baseline|current|diff|all" >&2; usage; exit 1;;
  esac
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    capture)      cmd_capture "$@";;
    capture-all)  cmd_capture_all "$@";;
    diff)         cmd_diff "$@";;
    list)         cmd_list;;
    clean)        cmd_clean "$@";;
    -h|--help|help|"") usage;;
    *) echo "ERROR: comando desconocido: $cmd" >&2; usage; exit 1;;
  esac
}

main "$@"
