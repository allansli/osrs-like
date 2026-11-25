#!/bin/bash
# usage: scripts/capped.sh <cmd...> — runs the command for this directory in the
# memory-capped container (`capped`, ~/.local/bin/capped: 3 GB, no swap, no network,
# wall-clock cap). `systemd-run --user` is not used: it needs a user service manager,
# which is absent after a WSL restart. node_modules must be a real directory here,
# not a symlink, because only the current directory is mounted.
exec capped "$@"
