# lan2cli

Turn plain-language requests into shell commands. Describe what you want, review the generated command and its explanation, then run, edit, revise or copy it.

lan2cli talks to OpenAI, Google Gemini, Anthropic Claude or a local Ollama model through one provider interface.

## Credit

lan2cli is a fork of [Builder.io's ai-shell](https://github.com/BuilderIO/ai-shell), released under the MIT license. The original work is copyright (c) 2023 Builder.io; modifications are copyright (c) 2026 Sie Ren-Bin. See [LICENSE](LICENSE).

Changes from upstream: a single `CompletionProvider` interface, Gemini, Claude and Ollama providers alongside OpenAI, and the rename to lan2cli.

## Providers

| Provider | `PROVIDER` value | Credentials                                    | Default model            |
| -------- | ---------------- | ---------------------------------------------- | ------------------------ |
| Gemini   | `gemini`         | `GEMINI_KEY`                                   | `gemini-3-flash-preview` |
| OpenAI   | `openai`         | `OPENAI_KEY` (optional `OPENAI_API_ENDPOINT`)  | `gpt-4o-mini`            |
| Claude   | `anthropic`      | `ANTHROPIC_KEY` or `ANTHROPIC_API_KEY` env var | `claude-opus-5-5`        |
| Ollama   | `ollama`         | none (`OLLAMA_HOST`)                           | `qwen2.5-coder:14b`      |

`gemini` is the provider when none is configured.

## Install from source

lan2cli is not published to npm. It needs Node.js 18 or newer.

```bash
git clone https://github.com/jasonsie/lan2cli.git
cd lan2cli
npm ci
npm run build   # bundles src/ into dist/cli.mjs (dist/ is not committed)
npm link        # puts `lan2cli` on your PATH
```

Run `npm run build` again after pulling changes or editing the source. To run straight from source without building, use `npm start -- "your prompt"`.

## Usage

```bash
lan2cli "list all log files"      # single prompt
lan2cli -p "list all log files"   # same, prompt as a flag
lan2cli -s "list all log files"   # silent: skip the explanation
lan2cli chat                      # interactive chat
lan2cli config                    # interactive settings menu
lan2cli config set KEY=VALUE      # set a value
lan2cli config get KEY            # read a value
lan2cli update                    # shows how to update a source install
```

## Configuration

Settings live in the INI file `~/.ai-shell`. Set them with `lan2cli config set` or the `lan2cli config` menu.

| Key                   | Meaning                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `PROVIDER`            | `gemini`, `openai`, `anthropic` or `ollama`                           |
| `MODEL`               | Model name for the selected provider; unset uses the provider default |
| `GEMINI_KEY`          | Google Gemini API key                                                 |
| `OPENAI_KEY`          | OpenAI API key                                                        |
| `OPENAI_API_ENDPOINT` | OpenAI-compatible base URL (default `https://api.openai.com/v1`)      |
| `ANTHROPIC_KEY`       | Anthropic API key                                                     |
| `OLLAMA_HOST`         | Ollama URL (default `http://localhost:11434`)                         |
| `SILENT_MODE`         | `true` to skip explanations                                           |

A `MODEL` that clearly belongs to another provider (for example a `gpt-*` name with `PROVIDER=anthropic`) is ignored with a warning and the provider default is used.

### Claude

```bash
lan2cli config set PROVIDER=anthropic
lan2cli config set ANTHROPIC_KEY=<your key>
```

Instead of `ANTHROPIC_KEY` you can export `ANTHROPIC_API_KEY`; the config value wins when both are set.

The default model is `claude-opus-5-5`. For faster, cheaper answers set another Claude model through the existing `MODEL` setting, for example:

```bash
lan2cli config set MODEL=claude-haiku-5-5
```

Request details: thinking is always on for Opus 5.5 and effort is fixed at `low` because command generation is a simple task. Temperature and other sampling parameters are never sent. For Opus, Sonnet, Fable and Mythos 5.x models the API retries a refused request on a fallback model; if the whole chain still refuses, lan2cli reports the refusal category.

### Ollama

Start `ollama serve`, pull a model (`ollama pull qwen2.5-coder:14b`), then:

```bash
lan2cli config set PROVIDER=ollama
```

## Development

```bash
npm test            # vitest, watch mode
npx vitest run      # single run
npm run typecheck
npm run lint
npm run build
```

Add a provider by implementing `CompletionProvider` in `src/helpers/providers/`, registering it in `index.ts`, and adding its config keys in `src/helpers/config.ts`. See [CLAUDE.md](CLAUDE.md) for the architecture notes.

## License

MIT. Copyright (c) 2023 Builder.io, copyright (c) 2026 Sie Ren-Bin.
