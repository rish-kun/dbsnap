#!/bin/bash
# Backup script that invokes the DBSnap CLI wrapper

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/dbsnap" && ./dbsnap --backup
