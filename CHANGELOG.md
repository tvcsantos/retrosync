# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-10

### Added

#### Core

- IGDB integration for game search with metadata, cover art, and platform info
- Extensible addon system with capability-based architecture (`sources:games`, `sources:bios`, `metadata`)
- ZIP-based addon installation from the UI with async extraction, real-time progress reporting, and cancellation support
- Automatic source deduplication for platforms sharing the same ROM collections (e.g., SNES/SFC, Neo Geo AES/MVS)
- Built-in local folder addon for discovering ROMs from local directories
- Import manager with queued imports, progress tracking, pause/resume, and concurrent transfers
- Library management with automatic file placement organized by platform
- BIOS management with source aggregation and installation
- 32 supported retro platforms (NES, SNES, N64, PS1, PS2, Dreamcast, and more)
- 11 pre-configured device profiles (Miyoo Mini Plus, Anbernic RG35XX, Steam Deck, and more)
- Custom device profile creation
- SQLite database with Drizzle ORM and WAL mode
- IGDB cover image caching
- Dark theme with retro gaming aesthetics

#### Documentation

- VitePress documentation site deployed to GitHub Pages
- Architecture overview with Draw.io diagrams (process architecture, data flow, import queue, database schema)
- Addon development guide with full API reference and examples
- Contributing guide with project structure, code style, and verification steps
- Changelog page with timeline-styled version history
- Hero section with animated logo and gradient styling
- Image lightbox support for documentation screenshots
- LLM-optimized documentation via `vitepress-plugin-llms` (`llms.txt` and `llms-full.txt`)

#### Infrastructure

- GitHub Actions workflow for documentation deployment to GitHub Pages
- GitHub Actions workflow for building and releasing Mac, Windows, and Linux installers
- Isolated `docs/package.json` for lightweight documentation CI builds
- Node 24 runtime requirement
- Electron 41 desktop runtime

[0.1.0]: https://github.com/tvcsantos/retrosync/releases/tag/v0.1.0
