// sherpa-onnx 离线 TTS 会话式 CLI：启动时加载一次模型，stdin/stdout 逐段 JSON。
#include <sherpa-onnx/c-api/c-api.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#include "json_protocol.h"

namespace {

struct HelperOptions {
  std::string family = "vits";
  std::string model;
  std::string voices;
  std::string vocoder;
  std::string tokens;
  std::string lexicon;
  std::string dataDir;
  std::string dictDir;
  std::string ruleFsts;
  int32_t numThreads = 2;
  int32_t debug = 0;
};

void printUsage(const char *argv0) {
  std::fprintf(stderr,
      "usage: %s --family vits|kokoro|matcha --model model.onnx --tokens tokens.txt "
      "[--voices voices.bin] [--vocoder vocoder.onnx] [--lexicon paths] "
      "[--data-dir dir] [--dict-dir dir] [--rule-fsts paths]\n", argv0);
}

bool parseOptions(int argc, char *argv[], HelperOptions &opt) {
  for (int i = 1; i + 1 < argc; i += 2) {
    std::string key = argv[i], value = argv[i + 1];
    if (key == "--family") opt.family = value;
    else if (key == "--model") opt.model = value;
    else if (key == "--voices") opt.voices = value;
    else if (key == "--vocoder") opt.vocoder = value;
    else if (key == "--tokens") opt.tokens = value;
    else if (key == "--lexicon") opt.lexicon = value;
    else if (key == "--data-dir") opt.dataDir = value;
    else if (key == "--dict-dir") opt.dictDir = value;
    else if (key == "--rule-fsts") opt.ruleFsts = value;
    else if (key == "--num-threads") opt.numThreads = std::atoi(value.c_str());
    else if (key == "--debug") opt.debug = std::atoi(value.c_str());
    else { std::fprintf(stderr, "tts-helper: 未知参数 %s\n", key.c_str()); return false; }
  }
  if (opt.model.empty() || opt.tokens.empty()) return false;
  if (opt.family == "kokoro") return !opt.voices.empty() && !opt.dataDir.empty();
  if (opt.family == "matcha") return !opt.vocoder.empty() && !opt.lexicon.empty();
  return opt.family == "vits";
}

void configureModel(const HelperOptions &opt, SherpaOnnxOfflineTtsConfig &config) {
  const char *lexicon = opt.lexicon.empty() ? "" : opt.lexicon.c_str();
  const char *dataDir = opt.dataDir.empty() ? "" : opt.dataDir.c_str();
  const char *dictDir = opt.dictDir.empty() ? "" : opt.dictDir.c_str();
  if (opt.family == "kokoro") {
    config.model.kokoro.model = opt.model.c_str();
    config.model.kokoro.voices = opt.voices.c_str();
    config.model.kokoro.tokens = opt.tokens.c_str();
    config.model.kokoro.data_dir = dataDir;
    config.model.kokoro.lexicon = lexicon;
    config.model.kokoro.dict_dir = dictDir;
    config.model.kokoro.length_scale = 1.0f;
  } else if (opt.family == "matcha") {
    config.model.matcha.acoustic_model = opt.model.c_str();
    config.model.matcha.vocoder = opt.vocoder.c_str();
    config.model.matcha.tokens = opt.tokens.c_str();
    config.model.matcha.lexicon = lexicon;
    config.model.matcha.data_dir = dataDir;
    config.model.matcha.dict_dir = dictDir;
    config.model.matcha.noise_scale = 0.667f;
    config.model.matcha.length_scale = 1.0f;
  } else {
    config.model.vits.model = opt.model.c_str();
    config.model.vits.tokens = opt.tokens.c_str();
    config.model.vits.lexicon = lexicon;
    config.model.vits.data_dir = dataDir;
    config.model.vits.dict_dir = dictDir;
    config.model.vits.noise_scale = 0.667f;
    config.model.vits.noise_scale_w = 0.8f;
    config.model.vits.length_scale = 1.0f;
  }
}

}  // namespace

int main(int argc, char *argv[]) {
  HelperOptions opt;
  if (!parseOptions(argc, argv, opt)) { printUsage(argv[0]); return 2; }

  SherpaOnnxOfflineTtsConfig config;
  std::memset(&config, 0, sizeof(config));
  configureModel(opt, config);
  config.model.num_threads = opt.numThreads;
  config.model.debug = opt.debug;
  config.model.provider = "cpu";
  config.rule_fsts = opt.ruleFsts.empty() ? "" : opt.ruleFsts.c_str();
  config.max_num_sentences = 1;
  config.silence_scale = 0.2f;

  const SherpaOnnxOfflineTts *tts = SherpaOnnxCreateOfflineTts(&config);
  if (!tts) {
    std::fprintf(stderr, "tts-helper: 引擎初始化失败（模型或资源路径有误）\n");
    return 3;
  }
  std::printf("{\"ready\":true,\"numSpeakers\":%d,\"sampleRate\":%d}\n",
              SherpaOnnxOfflineTtsNumSpeakers(tts), SherpaOnnxOfflineTtsSampleRate(tts));
  std::fflush(stdout);

  std::string line;
  while (true) {
    line.clear();
    int ch;
    bool eof = false;
    while ((ch = std::getchar()) != '\n') {
      if (ch == EOF) { eof = true; break; }
      if (ch != '\r') line.push_back(static_cast<char>(ch));
    }
    if (eof && line.empty()) break;
    SegmentTask task = parseTaskLine(line);
    if (task.isQuit) break;
    if (!task.valid || task.out.empty()) {
      std::printf("{\"ok\":false,\"error\":\"非法任务行\"}\n");
      std::fflush(stdout);
      continue;
    }
    const SherpaOnnxGeneratedAudio *audio =
        SherpaOnnxOfflineTtsGenerate(tts, task.text.c_str(), task.sid, task.speed);
    if (!audio || audio->n <= 0) {
      std::printf("{\"ok\":false,\"out\":\"%s\",\"error\":\"合成失败\"}\n",
                  jsonEscape(baseName(task.out)).c_str());
      std::fflush(stdout);
      if (audio) SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);
      continue;
    }
    int32_t written = SherpaOnnxWriteWave(
        audio->samples, audio->n, audio->sample_rate, task.out.c_str());
    if (written != 1) {
      std::printf("{\"ok\":false,\"out\":\"%s\",\"error\":\"WAV 写入失败\"}\n",
                  jsonEscape(baseName(task.out)).c_str());
    } else {
      std::printf("{\"ok\":true,\"out\":\"%s\",\"samples\":%d,\"sampleRate\":%d}\n",
                  jsonEscape(baseName(task.out)).c_str(), audio->n, audio->sample_rate);
    }
    std::fflush(stdout);
    SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);
  }
  SherpaOnnxDestroyOfflineTts(tts);
  return 0;
}
