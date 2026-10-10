# Test stand-ins for systemd and root checks used by `nextpress update-helper`.
# Sourced after scripts/nextpress by server/test/nextpress-update-runner.test.ts.
UNIT_DIR="$INSTALL_DIR/units"
mkdir -p "$UNIT_DIR"

systemd_unit_dir() {
	printf '%s\n' "$UNIT_DIR"
}

systemd_available() {
	[ "${FAKE_NO_SYSTEMD:-}" != "1" ]
}

running_as_root() {
	[ "${FAKE_NOT_ROOT:-}" != "1" ]
}

update_cli_path() {
	printf '%s\n' "/usr/local/bin/nextpress"
}

systemctl() {
	echo "systemctl $*" >> "$INSTALL_DIR/systemctl.log"
}
