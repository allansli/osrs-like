#!/bin/bash
# Runs a test command in the memory-capped container (~/.local/bin/capped: 3 GB, no swap, no network).
# `systemd-run --user` is not used: it needs a user service manager, absent after a WSL restart.
# node_modules must be a real directory here, since the container mounts only this worktree.
exec capped "$@"
