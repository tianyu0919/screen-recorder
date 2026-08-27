#include "json_protocol.h"

#include <cstdio>
#include <cstdlib>

namespace {

void appendUtf8(std::string &out, uint32_t cp) {
  if (cp < 0x80) out.push_back(static_cast<char>(cp));
  else if (cp < 0x800) {
    out.push_back(static_cast<char>(0xC0 | (cp >> 6)));
    out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
  } else if (cp < 0x10000) {
    out.push_back(static_cast<char>(0xE0 | (cp >> 12)));
    out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
  } else {
    out.push_back(static_cast<char>(0xF0 | (cp >> 18)));
    out.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
  }
}

struct JsonCursor {
  const std::string &s;
  size_t i = 0;
  explicit JsonCursor(const std::string &source) : s(source) {}

  void skipWs() { while (i < s.size() && (s[i] == ' ' || s[i] == '\t')) ++i; }

  bool parseString(std::string &out) {
    skipWs();
    if (i >= s.size() || s[i] != '"') return false;
    ++i;
    out.clear();
    while (i < s.size()) {
      char c = s[i++];
      if (c == '"') return true;
      if (c != '\\') { out.push_back(c); continue; }
      if (i >= s.size()) return false;
      char e = s[i++];
      switch (e) {
        case '"': out.push_back('"'); break;
        case '\\': out.push_back('\\'); break;
        case '/': out.push_back('/'); break;
        case 'b': out.push_back('\b'); break;
        case 'f': out.push_back('\f'); break;
        case 'n': out.push_back('\n'); break;
        case 'r': out.push_back('\r'); break;
        case 't': out.push_back('\t'); break;
        case 'u': {
          if (i + 4 > s.size()) return false;
          uint32_t cp = 0;
          for (int k = 0; k < 4; ++k) {
            char h = s[i++];
            cp <<= 4;
            if (h >= '0' && h <= '9') cp |= h - '0';
            else if (h >= 'a' && h <= 'f') cp |= h - 'a' + 10;
            else if (h >= 'A' && h <= 'F') cp |= h - 'A' + 10;
            else return false;
          }
          if (cp >= 0xD800 && cp <= 0xDBFF && i + 6 <= s.size() &&
              s[i] == '\\' && s[i + 1] == 'u') {
            uint32_t lo = 0;
            size_t j = i + 2;
            bool ok = true;
            for (int k = 0; k < 4; ++k) {
              char h = s[j++];
              lo <<= 4;
              if (h >= '0' && h <= '9') lo |= h - '0';
              else if (h >= 'a' && h <= 'f') lo |= h - 'a' + 10;
              else if (h >= 'A' && h <= 'F') lo |= h - 'A' + 10;
              else { ok = false; break; }
            }
            if (ok && lo >= 0xDC00 && lo <= 0xDFFF) {
              cp = 0x10000 + ((cp - 0xD800) << 10) + lo - 0xDC00;
              i = j;
            }
          }
          appendUtf8(out, cp);
          break;
        }
        default: return false;
      }
    }
    return false;
  }

  bool parseNumber(double &out) {
    skipWs();
    size_t start = i;
    if (i < s.size() && (s[i] == '-' || s[i] == '+')) ++i;
    while (i < s.size() && ((s[i] >= '0' && s[i] <= '9') || s[i] == '.' ||
           s[i] == 'e' || s[i] == 'E' || s[i] == '-' || s[i] == '+')) ++i;
    if (i == start) return false;
    out = std::strtod(s.substr(start, i - start).c_str(), nullptr);
    return true;
  }

  bool skipValue() {
    skipWs();
    if (i >= s.size()) return false;
    char c = s[i];
    if (c == '"') { std::string tmp; return parseString(tmp); }
    if (c == '{' || c == '[') {
      char open = c, close = c == '{' ? '}' : ']';
      int depth = 0;
      while (i < s.size()) {
        char ch = s[i++];
        if (ch == '"') { --i; std::string tmp; if (!parseString(tmp)) return false; continue; }
        if (ch == open) ++depth;
        else if (ch == close && --depth == 0) return true;
      }
      return false;
    }
    size_t start = i;
    while (i < s.size() && s[i] != ',' && s[i] != '}' && s[i] != ']' &&
           s[i] != ' ' && s[i] != '\t') ++i;
    return i > start;
  }
};

}  // namespace

SegmentTask parseTaskLine(const std::string &line) {
  SegmentTask task;
  JsonCursor cur(line);
  cur.skipWs();
  if (cur.i >= line.size() || line[cur.i] != '{') return task;
  ++cur.i;
  while (cur.i < line.size()) {
    cur.skipWs();
    if (cur.i < line.size() && line[cur.i] == '}') { task.valid = true; return task; }
    std::string key;
    if (!cur.parseString(key)) return SegmentTask{};
    cur.skipWs();
    if (cur.i >= line.size() || line[cur.i] != ':') return SegmentTask{};
    ++cur.i;
    if (key == "text") { if (!cur.parseString(task.text)) return SegmentTask{}; }
    else if (key == "out") { if (!cur.parseString(task.out)) return SegmentTask{}; }
    else if (key == "cmd") {
      std::string cmd;
      if (!cur.parseString(cmd)) return SegmentTask{};
      task.isQuit = cmd == "quit";
    } else if (key == "sid") {
      double value;
      if (!cur.parseNumber(value)) return SegmentTask{};
      task.sid = static_cast<int32_t>(value);
    } else if (key == "speed") {
      double value;
      if (!cur.parseNumber(value)) return SegmentTask{};
      task.speed = static_cast<float>(value);
    } else if (!cur.skipValue()) return SegmentTask{};
    cur.skipWs();
    if (cur.i < line.size() && line[cur.i] == ',') ++cur.i;
  }
  return SegmentTask{};
}

std::string jsonEscape(const std::string &value) {
  std::string out;
  out.reserve(value.size() + 8);
  for (unsigned char c : value) {
    if (c == '"' || c == '\\') { out.push_back('\\'); out.push_back(static_cast<char>(c)); }
    else if (c < 0x20) { char buf[8]; std::snprintf(buf, sizeof(buf), "\\u%04x", c); out += buf; }
    else out.push_back(static_cast<char>(c));
  }
  return out;
}

std::string baseName(const std::string &path) {
  size_t pos = path.find_last_of("/\\");
  return pos == std::string::npos ? path : path.substr(pos + 1);
}
