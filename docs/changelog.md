# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<div class="changelog">

## Unreleased

<div class="changelog-entry">

## <span class="changelog-version">0.1.0</span> <span class="changelog-date">2025-05-10</span>

### Added {.changelog-category .changelog-added}

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

</div>

</div>
