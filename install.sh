#!/bin/bash
set -e

# Sonder CLI Installer
# Usage: curl -fsSL https://trysonder.ai/install.sh | bash

REPO="Sonder-inc/sonder"
INSTALL_DIR="${SONDER_INSTALL_DIR:-$HOME/.sonder}"
BIN_DIR="${SONDER_BIN_DIR:-$HOME/.local/bin}"

# Colors
GREEN='\033[0;32m'
GRAY='\033[0;90m'
NC='\033[0m'

# Detect platform
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Linux*)  OS="linux" ;;
    Darwin*) OS="darwin" ;;
    *)       echo "Unsupported OS: $OS"; exit 1 ;;
  esac

  case "$ARCH" in
    x86_64)  ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)       echo "Unsupported arch: $ARCH"; exit 1 ;;
  esac

  PLATFORM="${OS}-${ARCH}"
}

# Get latest release info (including prereleases)
get_latest_release() {
  # Try latest stable first, then fall back to any release (including prerelease)
  RELEASE_INFO=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null)
  VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')

  if [ -z "$VERSION" ]; then
    # Fall back to first release (could be prerelease)
    RELEASE_INFO=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases" 2>/dev/null)
    VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
  fi

  if [ -z "$VERSION" ]; then
    echo "Could not fetch latest release"
    exit 1
  fi

  # Asset name: sonder-darwin-arm64.tar.gz
  ASSET_NAME="sonder-${PLATFORM}.tar.gz"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET_NAME}"
}

# Download with progress
download_with_progress() {
  local url=$1
  local output=$2

  # Use curl with progress bar
  curl -#fSL "$url" -o "$output" 2>&1 | \
    stdbuf -oL tr '\r' '\n' | \
    grep -oE '[0-9]+\.[0-9]' | \
    while read -r pct; do
      printf "\rDownloading... [%-40s] %5.1f%%" \
        "$(printf '%*s' "${pct%.*}" '' | tr ' ' '█')" "$pct"
    done

  # Fallback if progress didn't work
  if [ ! -f "$output" ]; then
    curl -fsSL "$url" -o "$output"
  fi
}

# Install sonder
install_sonder() {
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$BIN_DIR"

  TMP_DIR=$(mktemp -d)
  TMP_FILE="$TMP_DIR/sonder.tar.gz"

  # Download
  echo -n "Downloading sonder ${VERSION}... "
  if curl -#fSL "$DOWNLOAD_URL" -o "$TMP_FILE" 2>/dev/null; then
    echo "done"
  else
    echo "failed"
    rm -rf "$TMP_DIR"
    exit 1
  fi

  # Extract
  echo -n "Installing... "
  tar -xzf "$TMP_FILE" -C "$INSTALL_DIR"

  # Create symlink
  ln -sf "$INSTALL_DIR/sonder" "$BIN_DIR/sonder"

  # Save version
  echo "$VERSION" > "$INSTALL_DIR/version"

  # Cleanup
  rm -rf "$TMP_DIR"
  echo "done"
}

# Add to PATH if needed
setup_path() {
  if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
      bash) PROFILE="$HOME/.bashrc" ;;
      zsh)  PROFILE="$HOME/.zshrc" ;;
      fish) PROFILE="$HOME/.config/fish/config.fish" ;;
      *)    PROFILE="$HOME/.profile" ;;
    esac

    if [ -f "$PROFILE" ] && ! grep -q "sonder" "$PROFILE"; then
      echo "" >> "$PROFILE"
      echo "# Sonder CLI" >> "$PROFILE"
      echo "export PATH=\"\$PATH:$BIN_DIR\"" >> "$PROFILE"
      echo -e "${GRAY}Run: source $PROFILE${NC}"
    fi
  fi
}

# Main
main() {
  detect_platform
  get_latest_release
  install_sonder
  setup_path
  echo -e "${GREEN}sonder ${VERSION} installed${NC}"
}

main "$@"
