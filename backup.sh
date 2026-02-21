#!/bin/bash
# Backup script updated to use the compiled DBSnap CLI

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/dbsnap" && ./dbsnap --backup
