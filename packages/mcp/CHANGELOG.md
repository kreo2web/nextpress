# Changelog

## [0.3.0] - 2026-10-17

### Added
- **Page-scoped tools** (page UUID/slug + `content_type`): `get_page_outline`, `get_page_block`, `change_page_blocks`, `check_page`, `apply_page_phone_fixes`. They run the SDK's shared page tools against a saved page or post, and save with the version they read.
- **Site-level tools**: `list_block_types` (text lines, no JSON), `get_block_type`, `get_design_guide`.
- **New over SDK 0.3**: `get_page_history`, `restore_page_version`, `list_template_parts`, `create_template_part`, `get_template_part_usage`, `list_form_submissions`, `copy_brand_logo`.
- **Prompts**: `build_page` (brief + workflow + design guide) and `edit_block`.
- **Resource**: `nextpress://design-guide`; the blocks catalog now carries an agent note per block.
- Short server `instructions` pointing agents at the outline → change → check workflow.
- Page-changing calls queue per page, so two sent together land in order.

### Changed
- 44 tools, up from 30. `patch_page_blocks`/`patch_post_blocks`/`build_blocks` keep working; their descriptions point at `change_page_blocks`.
- Tool descriptions, replies and the guide use the MCP tool names.

### Fixed
- Every tool's JSON schema is now `$ref`-free (the shared schema pieces are built fresh per use), so strict JSON-schema readers accept them.

### Dependencies
- Requires `@nextpress-org/sdk` ^0.3.0 (linked as `workspace:^` in this repo). `@modelcontextprotocol/sdk` raised to ^1.32.1.
