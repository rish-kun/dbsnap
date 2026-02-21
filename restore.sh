#!/bin/bash
# Restore script updated to use the compiled DBSnap CLI

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -z "$1" ]; then
    echo "Starting interactive restore..."
    cd "$DIR/dbsnap" && ./dbsnap
else
    echo "Running headlesbs restore for ID $1..."
    cd "$DIR/dbsnap" && ./dbsnap --restore "$1"
fi
