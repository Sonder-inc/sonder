# Contributing to Sonder

Thank you for your interest in contributing to Sonder! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/sonder.git`
3. Install dependencies: `bun install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Bun v1.0+ (runtime and package manager)
- Node.js v22+ (for compatibility)
- Git

### Running Locally

```bash
bun run cli/index.tsx
```

### Project Structure

```
cli/
├── src/
│   ├── components/        # React/Ink UI components
│   │   ├── panels/       # Panel components (context, worktree, etc.)
│   │   ├── school/       # School mode components
│   │   └── sidebar/      # Sidebar section components
│   ├── constants/        # App constants and configuration
│   ├── data/            # Static data (curriculum, machines)
│   ├── hooks/           # React hooks
│   ├── parser/          # Stream parsing utilities
│   ├── services/        # API services (OpenRouter, Gemini, etc.)
│   ├── state/           # Zustand stores
│   ├── tools/           # AI tool definitions
│   └── utils/           # Utility functions
├── index.tsx            # Entry point
└── package.json
```

## Code Style

- Use TypeScript for type safety
- Follow existing code formatting (we use Prettier defaults)
- Use meaningful variable and function names
- Add comments for complex logic
- Keep components small and focused

## Making Changes

### Commit Messages

Follow this style:
- `feature: add xyz` - New features
- `fix: resolve xyz` - Bug fixes
- `chore: update xyz` - Maintenance tasks
- `refactor: improve xyz` - Code improvements
- Keep messages concise and descriptive

### Pull Requests

1. Ensure your code builds: `bun run cli/index.tsx`
2. Test your changes thoroughly
3. Update documentation if needed
4. Create a pull request with:
   - Clear title describing the change
   - Description of what changed and why
   - Screenshots/GIFs for UI changes
   - Link to related issues

## Areas to Contribute

### Easy Picks (Good First Issues)

- Add new keyboard shortcuts
- Improve UI/UX in existing components
- Add new machine data to curriculum
- Documentation improvements
- Bug fixes

### Medium Complexity

- New AI tools for vulnerability detection
- Platform API integrations
- State management improvements
- New sidebar sections

### Advanced

- Terminal integration with node-pty
- Headless AI agent integration
- Complex tool execution systems
- Multi-platform synchronization

## Testing

Currently, we don't have automated tests (yet!). When testing:

1. Test basic flows (startup, navigation, commands)
2. Test school mode navigation
3. Test AI interactions
4. Test with different terminal sizes
5. Test keyboard shortcuts

## Architecture Guidelines

### State Management

- Use Zustand stores for global state
- Use Immer middleware for immutable updates
- Keep stores focused on specific domains

### Components

- Use functional components with hooks
- Keep components pure when possible
- Extract reusable logic into hooks
- Use memo/callback when needed for performance

### AI Integration

- All AI calls go through services layer
- Tools are defined in `src/tools/`
- Support streaming responses
- Handle errors gracefully

## Security

This project deals with security tooling. Please:

- Never commit API keys or secrets
- Validate all external inputs
- Be cautious with command execution
- Report security issues privately to maintainers

## Questions?

- Open an issue for bugs or feature requests
- Use discussions for questions and ideas
- Check existing issues before creating new ones

## Code of Conduct

- Be respectful and inclusive
- Help others learn and grow
- Give constructive feedback
- Focus on the code, not the person

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
