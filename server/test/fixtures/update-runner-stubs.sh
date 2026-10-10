# Test stand-ins for the outside world of `nextpress update-runner` (GitHub,
# Docker, the upgrade itself). Sourced after scripts/nextpress by
# server/test/nextpress-update-runner.test.ts; FAKE_* variables steer them.
CALLS="$INSTALL_DIR/calls.log"

fetch_latest_release_version() {
	# What the dashboard could read while the runner was still checking.
	cp "$INSTALL_DIR/update/status.json" "$INSTALL_DIR/status-during-check.json" 2>/dev/null || true
	if [ "${FAKE_LATEST_FAILS:-}" = "1" ]; then
		return 1
	fi
	printf '%s\n' "${FAKE_LATEST:-1.4.3}"
}

pull_release_image() {
	echo "pull $1" >> "$CALLS"
	if [ "${FAKE_PULL_FAILS:-}" = "1" ]; then
		echo "Error response from daemon: manifest unknown"
		return 1
	fi
}

run_core_upgrade() {
	echo "upgrade $1" >> "$CALLS"
	if [ -n "${FAKE_UPGRADE_ERROR:-}" ]; then
		echo "Error: ${FAKE_UPGRADE_ERROR}"
		return 1
	fi
}

restore_previous_release() {
	echo "restore $UPDATE_RUN_FROM_TAG" >> "$CALLS"
	[ "${FAKE_RESTORE_FAILS:-}" != "1" ]
}

upgrade_lock_busy() {
	[ "${FAKE_LOCK_BUSY:-}" = "1" ]
}
