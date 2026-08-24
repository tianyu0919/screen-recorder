#!/bin/bash
# 编译 window-geometry（macOS 窗口几何采样 helper，无 Xcode 工程，直接 swiftc）
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p bin
/usr/bin/swiftc -O -o bin/window-geometry main.swift
echo "built: native/window-geometry/darwin/bin/window-geometry"
