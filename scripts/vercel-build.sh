#!/usr/bin/env bash
set -euo pipefail

VERSION="0.37.23"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v jac >/dev/null 2>&1 || ! jac --version 2>/dev/null | grep -q "$VERSION"; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) asset="jac-${VERSION}-linux-x86_64" ;;
    Linux-aarch64 | Linux-arm64) asset="jac-${VERSION}-linux-aarch64" ;;
    Darwin-arm64) asset="jac-${VERSION}-macos-aarch64" ;;
    *)
      echo "No Jac ${VERSION} binary for $(uname -s)-$(uname -m)" >&2
      exit 1
      ;;
  esac

  bindir="$ROOT/.jac/vercel-bin"
  mkdir -p "$bindir"
  url="https://github.com/jaseci-labs/jaseci/releases/download/v${VERSION}/${asset}"
  curl -fsSL "$url" -o "$bindir/$asset"
  curl -fsSL "${url}.sha256" -o "$bindir/${asset}.sha256"
  expected="$(awk '{print $1}' "$bindir/${asset}.sha256")"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$bindir/$asset" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$bindir/$asset" | awk '{print $1}')"
  fi
  if [ "$expected" != "$actual" ]; then
    echo "Jac checksum mismatch for ${asset}" >&2
    exit 1
  fi
  chmod +x "$bindir/$asset"
  export PATH="$bindir:$PATH"
  ln -sfn "$asset" "$bindir/jac"
fi

jac build --as client

rm -rf dist
mkdir -p dist
cp .jac/client/dist/index.html .jac/client/dist/*.css .jac/client/dist/*.js dist/
if compgen -G ".jac/client/dist/*.map" >/dev/null; then
  cp .jac/client/dist/*.map dist/
fi
