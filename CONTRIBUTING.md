# Contributing to Ripple

Ripple is a TypeScript UI framework that combines the best parts of React, Solid, and Svelte into one cohesive package. Built as a love letter to frontend development, Ripple introduces a JS/TS-first approach with `.ripple` modules that provide an excellent developer experience for both humans and LLMs.

The [Open Source Guides](https://opensource.guide/) website offers valuable resources for individuals, communities, and companies looking to contribute to open source projects. Both newcomers and experienced contributors will find these guides particularly helpful:

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Building Welcoming Communities](https://opensource.guide/building-community/)

## Ways to Get Involved

There are numerous ways to contribute to Ripple, and many don't require writing code. Here are some ideas to get started:

- **Start experimenting with Ripple**: Try out the [Ripple Playground](https://www.ripplejs.com/playground) and see how it works. If you encounter issues or unexpected behavior, we'd love to hear about it through [opening an issue](#reporting-issues).
- **Browse existing issues**: Check out our [open issues](https://github.com/Ripple-TS/ripple/issues). You can help by providing workarounds or asking clarifying questions.
- **Submit fixes**: Found an issue you'd like to tackle? Consider [opening a pull request](#pull-requests).
- **Help with documentation**: As Ripple grows, we'll need comprehensive documentation. Any help improving clarity or filling gaps would be greatly appreciated.

We welcome all contributions! If you need guidance in planning your contribution, please reach out on our Discord server and let us know you're looking for some direction.

### Issue Triage

A fantastic way to contribute without coding is helping triage issues and pull requests:

- Request additional information when issues lack sufficient detail for resolution.
- Identify stale issues that should be updated or closed.
- Review code and suggest improvements.
- Help organize and categorize incoming issues.

## Development Process

### Planning Major Changes

For significant new features or substantial changes, we encourage discussion before implementation. While we don't have a formal RFC process yet, please open an issue to discuss your ideas with the maintainers and community first.

### Current Focus

Ripple is in early alpha, so our priorities are:

1. Stabilizing core functionality
2. Improving TypeScript integration (note that the internal codebase is still being migrated from JS, so some TypeScript errors are expected)
3. Expanding test coverage
4. Building and maintaining essential tooling

Keep in mind that this is a very early-stage project, so expect frequent changes and some rough edges.

### Communication

Since Ripple is a new project with a small team, we'll do our best to respond to issues and PRs promptly. Join [our Discord server](https://discord.gg/JBF2ySrh2W) for real-time discussion and updates.

## Reporting Issues

We track bugs using [GitHub issues](https://github.com/Ripple-TS/ripple/issues). Before reporting a new issue, please check if someone has already reported the same problem.

For questions about using Ripple, our Discord server is the best place to get help and connect with other developers.

### Creating Bug Reports

When [opening a new issue](https://github.com/Ripple-TS/ripple/issues/new), please include:

- **Clear description**: Explain what you expected to happen and what actually occurred.
- **Reproduction steps**: Provide step-by-step instructions to reproduce the issue.
- **Environment details**: Include your operating system, Node.js version, and any relevant setup information.
- **Minimal example**: If possible, create a minimal reproduction case that demonstrates the problem.

**Important guidelines:**

- Report one bug per issue
- Be as specific as possible
- Include code samples when relevant

## Pull Requests

### Before You Start

For bug fixes, feel free to submit a pull request directly, but we recommend filing an issue first to discuss the problem and proposed solution.

For new features, please open an issue to discuss the implementation before starting work. This helps ensure your contribution aligns with the project's direction.

Keep pull requests focused and reasonably sized for easier review.

### Development Setup

You'll need [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/installation) installed.

1. Fork the repository
2. Clone your fork locally
3. Run `pnpm install` to install dependencies
4. Create a new branch from `main` for your changes

### Development Workflow

Since Ripple is in early development, the build process may evolve. Currently:

- Run development builds and watch for changes as needed
- Test your changes thoroughly
- Ensure TypeScript compilation succeeds (if working with TS code)

### Testing

While our test suite is still being developed, please:

- Test your changes manually
- Verify that existing functionality still works
- Include test cases for new features when possible
- Document your testing approach in the PR description

### Code Style

We'll be implementing consistent code formatting soon. For now:

- Follow existing code patterns in the repository
- Use meaningful variable and function names
- Include appropriate comments for complex logic
- Maintain TypeScript types where applicable

### Submitting Your PR

Before submitting:

1. **Test thoroughly**: Ensure your changes work as expected
2. **Write clear commit messages**: Describe what and why, not just what
3. **Update documentation**: If you've changed APIs or added features
4. **Target the main branch**: All PRs should be opened against `main`
5. **Keep it focused**: One feature or fix per PR

Include in your PR description:

- Summary of changes
- Testing performed
- Any breaking changes
- Related issue numbers

## Development Guidelines

### Code Conventions

Since Ripple is TypeScript-first:

- Prioritize type safety
- Use descriptive names for variables and functions
- Follow existing patterns in the codebase
- Comment complex logic clearly

### Commit Messages

Write clear, descriptive commit messages that explain both what changed and why.

## License

By contributing to Ripple, you agree that your contributions will be licensed under the same license as the project. [MIT License](./LICENSE)

## Getting Help

- **Discord**: Join [our community server](https://discord.gg/JBF2ySrh2W) for real-time discussion
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For general questions and ideas (when available)

We're excited to have you contribute to Ripple's development! Even though the project is young, every contribution helps shape its future.
