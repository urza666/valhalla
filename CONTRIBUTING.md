# Contributing to Valhalla

Thank you for your interest in contributing to Valhalla! This project is a love letter to the open source community, and every contribution makes it better.

## How to Contribute

### Reporting Bugs

- Open an issue with a clear description
- Include steps to reproduce
- Include your environment (OS, Go version, browser)
- Screenshots or logs are helpful

### Suggesting Features

- Open an issue with the "feature request" label
- Describe the problem you're trying to solve
- Explain your proposed solution
- Consider the scope (MVP vs. future)

### Code Contributions

1. **Fork** the repository
2. **Create a branch** from `main` (`git checkout -b feature/my-feature`)
3. **Make your changes** following the code style below
4. **Test** your changes (`make test`)
5. **Commit** with a clear message
6. **Open a Merge Request** against `main`

### Code Style

**Go:**
- Follow standard Go conventions (`gofmt`, `go vet`)
- Use meaningful variable names
- Write table-driven tests where applicable
- No unnecessary abstractions

**TypeScript/React:**
- Use functional components with hooks
- Keep components small and focused
- Use TypeScript strictly (no `any` where avoidable)

**SQL:**
- Use snake_case for table and column names
- Always add indexes for foreign keys and common query patterns
- Use migrations for all schema changes

### Development Setup

```bash
# Clone
git clone https://github.com/urza666/valhalla.git
cd valhalla

# Start infrastructure
make dev

# Run migrations
make migrate-up

# Start API
make run-api

# Start web client
cd web && npm install && npm run dev
```

### Project Structure

```
cmd/         - Entry points (api, gateway, migrate)
internal/    - Business logic (one package per domain)
pkg/         - Shared libraries (snowflake, permissions, etc.)
web/         - React web client
mobile/      - React Native mobile client
desktop/     - Tauri desktop client
migrations/  - SQL migrations
deployments/ - Docker, Compose, Caddy
docs/        - Architecture documentation
```

## Code of Conduct

Be kind, be respectful, be constructive. We're all here to build something great together.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (AGPL-3.0 with Commons Clause for commercial use).
