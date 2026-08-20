#!/bin/bash
# 编译 sck-audio（macOS 系统音频原生采集 helper，无 Xcode 工程，直接 swiftc）
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p bin
/usr/bin/swiftc -O -o bin/sck-audio main.swift
echo "built: native/sck-audio/bin/sck-audio"
