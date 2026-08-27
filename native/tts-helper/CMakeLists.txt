# tts-helper：sherpa-onnx 离线 TTS 会话式 CLI（kr-08-tts-dubbing）
# 一份源码双平台编译；vendor 与产物不入库。
cmake_minimum_required(VERSION 3.20)
project(tts-helper CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# SHERPA_ONNX_DIR 指向解压后的 sherpa-onnx 预编译包（含 include/ 与 lib/ 或 bin/）。
if(NOT DEFINED SHERPA_ONNX_DIR)
  message(FATAL_ERROR "需要 -DSHERPA_ONNX_DIR=<sherpa-onnx 预编译包目录>")
endif()

add_executable(tts-helper src/main.cpp src/json_protocol.cpp)
target_include_directories(tts-helper PRIVATE "${SHERPA_ONNX_DIR}/include")

if(APPLE)
  target_link_directories(tts-helper PRIVATE "${SHERPA_ONNX_DIR}/lib")
  target_link_libraries(tts-helper PRIVATE sherpa-onnx-c-api)
  # 运行时从可执行文件旁加载 dylib（dylib 会被拷到同目录）
  set_target_properties(tts-helper PROPERTIES
    BUILD_RPATH "@executable_path"
    INSTALL_RPATH "@executable_path")
elseif(WIN32)
  target_link_directories(tts-helper PRIVATE "${SHERPA_ONNX_DIR}/lib")
  target_link_libraries(tts-helper PRIVATE sherpa-onnx-c-api)
else()
  message(FATAL_ERROR "tts-helper 一期只支持 darwin / win32")
endif()
