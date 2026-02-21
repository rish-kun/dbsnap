#!/bin/bash
# Cron job script updated to use the compiled DBSnap CLI

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/dbsnap" && ./dbsnap --run >> ../dbsnap.log 2>&1
echo "Cron job executed"
