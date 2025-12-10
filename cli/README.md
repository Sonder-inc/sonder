# Sonder

An alternative frontend for TryHackMe and HackTheBox, built as a powerful CLI tool with AI-powered assistance.

![Sonder CLI Screenshot](docs/screenshot.png)

## Features

- **School Mode**: Interactive hacking playground to rank up your skills
- **AI Assistance**: Multiple AI models (Claude, Gemini, Codex) with tool support
- **Machine Browser**: Browse and track progress on CTF machines from multiple platforms
- **Topic-Based Learning**: Organized by security topics (Fundamentals, Injection, Access, Shells, Privilege Escalation, etc.)
- **Progress Tracking**: Track your XP, owned machines, and learning progress
- **Context Management**: Smart context tracking with worktree-style thread management
- **Multi-Platform**: Support for TryHackMe and HackTheBox machines

## Installation

```bash
bun install
```

## Usage

```bash
bun run cli/index.tsx
```

### Available Commands

- `/school` - Enter hacking playground mode to browse machines and rank up
- `/login` - Login to platform accounts
- `/logout` - Logout from platform accounts
- `/init` - Initialize sonder in current directory
- `/doctor` - Diagnose and verify your installation
- `/feedback` - Submit feedback or report a bug
- `/exit` - Exit the REPL

### Keyboard Shortcuts

Press `?` in the app to view all available shortcuts.

## Configuration

Sonder supports multiple AI providers:

- **OpenRouter**: Set `OPENROUTER_API_KEY` environment variable
- **Anthropic**: Set `ANTHROPIC_API_KEY` environment variable (for Claude direct)
- **BYOK**: Bring Your Own Key through the login flow

## Development

Built with:
- Bun runtime
- React/Ink for TUI
- Zustand for state management
- AI SDK for LLM integration

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and improvements.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
