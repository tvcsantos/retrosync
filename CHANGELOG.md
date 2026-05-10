# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-05-10

### Added

- IGDB integration for game search with metadata, cover art, and platform info
- Extensible addon system with capability-based architecture (`sources:games`, `sources:bios`, `metadata`)
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
- VitePress documentation site with architecture, contributing, and addon development guides

[Unreleased]: https://github.com/tvcsantos/retrosync/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tvcsantos/retrosync/releases/tag/v0.1.0
