#pragma once

#include <cstdint>
#include <string>

struct SegmentTask {
  bool isQuit = false;
  bool valid = false;
  std::string text;
  std::string out;
  int32_t sid = 0;
  float speed = 1.0f;
};

SegmentTask parseTaskLine(const std::string &line);
std::string jsonEscape(const std::string &value);
std::string baseName(const std::string &path);
