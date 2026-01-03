# Contributing to electron-to-web

Thank you for your interest in contributing to electron-to-web! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful and constructive in all interactions. We're here to build something useful together.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Git
- npm or yarn

### Setup Development Environment

1. **Fork and clone the repository**

```bash
git clone git@github.com:YOUR_USERNAME/electron-to-web.git
cd electron-to-web
```

2. **Install dependencies**

```bash
npm install
npm install express  # Peer dependency for testing
```

3. **Build the project**

```bash
npm run build
```

4. **Run tests**

```bash
npm test
```

## Development Workflow

### Project Structure

```
electron-to-web/
├── src/
│   ├── main/           # Main process APIs (ipcMain, BrowserWindow)
│   ├── renderer/       # Renderer process APIs (ipcRenderer)
│   ├── server/         # Server factory (Express + WebSocket)
│   └── shared/         # Shared types and utilities
├── tests/
│   ├── e2e.test.mjs    # E2E test suite
│   ├── test-server.mjs # Test server
│   └── *.mjs           # Test utilities
├── examples/           # Example implementations
└── dist/               # Compiled output (gitignored)
```

### Making Changes

1. **Create a feature branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**

- Write code following existing patterns
- Add tests for new functionality
- Update documentation as needed

3. **Test your changes**

```bash
# Run full test suite
npm test

# Run tests in watch mode during development
npm run test:watch

# Build and verify TypeScript compilation
npm run build
```

4. **Commit your changes**

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in connection handling"
git commit -m "docs: update API documentation"
git commit -m "test: add tests for error handling"
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

5. **Push and create a Pull Request**

```bash
git push origin feature/your-feature-name
```

Then create a PR on GitHub.

## Testing Guidelines

### Writing Tests

All new features must include tests. We use Mocha + Chai for testing.

**Test structure:**

```javascript
describe('Feature Name', function() {
  it('should do something specific', async function() {
    // Arrange
    const input = 'test';

    // Act
    const result = await someFunction(input);

    // Assert
    expect(result).to.equal('expected');
  });
});
```

**Running tests:**

```bash
# Full test suite with report
npm test

# Just run mocha
npm run test:mocha

# Watch mode
npm run test:watch
```

### Test Coverage Requirements

- New features must have tests
- Bug fixes should include regression tests
- Aim for 100% coverage of critical paths
- All tests must pass before PR is merged

## Pull Request Process

1. **Ensure all tests pass**
   - CI will run automatically
   - Fix any failing tests before requesting review

2. **Update documentation**
   - Update README.md if adding features
   - Update ARCHITECTURE.md for design changes
   - Update FEATURE_PARITY.md for API changes
   - Add entry to CHANGELOG.md

3. **Request review**
   - Describe what changed and why
   - Link to related issues
   - Add screenshots/demos if applicable

4. **Address feedback**
   - Make requested changes
   - Push updates to the same branch
   - Re-request review when ready

5. **Merge**
   - PRs are merged by maintainers
   - Must pass all CI checks
   - Requires at least one approval

## Release Process

Releases are automated via GitHub Actions:

1. **Update version**

```bash
# Update version in package.json
npm version patch  # 0.1.0 -> 0.1.1
npm version minor  # 0.1.0 -> 0.2.0
npm version major  # 0.1.0 -> 1.0.0
```

2. **Update CHANGELOG.md**

Add release notes under the new version heading.

3. **Create and push tag**

```bash
git push origin main --tags
```

4. **Automated publishing**

GitHub Actions will:
- Run all tests
- Publish to NPM
- Create GitHub release
- Attach test report

## Code Style

### TypeScript

- Use TypeScript for all source code
- Enable strict mode
- Provide type definitions for all exports
- Avoid `any` types unless absolutely necessary

### Formatting

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in objects/arrays

### Naming Conventions

- `camelCase` for variables and functions
- `PascalCase` for classes and types
- `UPPER_CASE` for constants
- Descriptive names (avoid abbreviations)

## Documentation

### Code Comments

- Use JSDoc for public APIs
- Explain *why*, not *what*
- Keep comments up to date

### Documentation Files

- **README.md**: User-facing guide
- **ARCHITECTURE.md**: Technical design
- **FEATURE_PARITY.md**: Electron compatibility
- **CONTRIBUTING.md**: This file

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/lsadehaan/electron-to-web/issues)
- **Discussions**: [GitHub Discussions](https://github.com/lsadehaan/electron-to-web/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
