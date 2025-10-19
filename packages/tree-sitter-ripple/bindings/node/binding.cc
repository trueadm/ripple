#include "napi.h"

extern "C" TSLanguage *tree_sitter_ripple();

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports["language"] = Napi::External<TSLanguage>::New(env, tree_sitter_ripple());
	return exports;
}

NODE_API_MODULE(tree_sitter_ripple_binding, Init)
