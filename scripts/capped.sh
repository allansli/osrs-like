#!/bin/bash
# usage: sg.sh <cmd...>  — runs in allowlisted env under memory cap
exec env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 "$@"
