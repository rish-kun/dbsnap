#!/bin/bash

DBsnap_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DBsnap_BIN="$DBsnap_DIR/dbsnap"
DBsnap_PATH_DIR="$DBsnap_DIR"

if [ ! -f "$DBsnap_BIN" ]; then
    echo "Error: dbsnap executable not found at $DBsnap_BIN"
    exit 1
fi

export PATH="$DBsnap_PATH_DIR:$PATH"

SHELL_NAME=$(basename "$SHELL")

if [ "$SHELL_NAME" = "zsh" ]; then
    RC_FILE="$HOME/.zshrc"
    SHELL_LINE="export PATH=\"$DBsnap_PATH_DIR:\$PATH\""
elif [ "$SHELL_NAME" = "bash" ]; then
    if [ -f "$HOME/.bashrc" ]; then
        RC_FILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
        RC_FILE="$HOME/.bash_profile"
    else
        RC_FILE="$HOME/.bashrc"
    fi
    SHELL_LINE="export PATH=\"$DBsnap_PATH_DIR:\$PATH\""
else
    echo "Unsupported shell: $SHELL_NAME"
    echo "Please manually add the following to your shell config:"
    echo "export PATH=\"$DBsnap_PATH_DIR:\$PATH\""
    exit 1
fi

if ! grep -qF "$SHELL_LINE" "$RC_FILE" 2>/dev/null; then
    echo "" >> "$RC_FILE"
    echo "# DBSnap CLI" >> "$RC_FILE"
    echo "$SHELL_LINE" >> "$RC_FILE"
    echo "Added dbsnap to PATH in $RC_FILE"
else
    echo "dbsnap is already in PATH in $RC_FILE"
fi

echo "DBSnap CLI is now available. Run 'dbsnap' to start."
