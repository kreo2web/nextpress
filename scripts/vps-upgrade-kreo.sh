#!/usr/bin/env bash
#
# vps-upgrade-kreo.sh
# Actualiza una instalación NextPress self-hosted conservando datos y parches propios.
#
# Pensado para un VPS con el layout del CLI oficial (por defecto /opt/nextpress):
#   .env, docker-compose.prod.yml, nextpress.config.json, caddy_config/, backups/
#
# Qué hace:
#   1. Comprueba requisitos, espacio en disco y que el CLI existe.
#   2. Respalda BD (pg_dump), uploads (volumen docker), .env, compose, config y Caddy,
#      y deja un rollback.sh junto al respaldo.
#   3. Apaga las actualizaciones desde el panel (update-helper off).
#   4. Clona/actualiza la rama propia y construye la imagen con los parches.
#   5. Ejecuta `nextpress upgrade --version <tag>` SIN pull (usa la imagen local).
#   6. Verifica salud y resume el resultado.
#
# Uso:
#   sudo bash vps-upgrade-kreo.sh --dry-run
#   sudo bash vps-upgrade-kreo.sh
#   sudo bash vps-upgrade-kreo.sh --version 1.7.0 --branch local/kreotuweb-1.7
#   sudo bash vps-upgrade-kreo.sh --rebuild --with-export
#
# Opciones:
#   --version X.Y.Z      Versión a instalar (por defecto 1.6.0)
#   --branch <rama>      Rama con parches (por defecto local/kreotuweb-<X.Y>)
#   --rebuild            Reconstruye la imagen aunque ya exista
#   --with-export        Añade `nextpress export --with-media-files` al respaldo
#   --skip-backup        NO recomendado: omite el respaldo
#   --dry-run            Muestra el plan y no modifica nada
#   -h, --help           Esta ayuda
#
# Variables de entorno opcionales:
#   NEXTPRESS_INSTALL_DIR, NEXTPRESS_SRC_DIR, NEXTPRESS_SRC_REPO,
#   NEXTPRESS_UPLOADS_VOLUME, NEXTPRESS_BACKUP_ROOT, NEXTPRESS_CLI
#
set -Eeuo pipefail

INSTALL_DIR="${NEXTPRESS_INSTALL_DIR:-/opt/nextpress}"
SRC_DIR="${NEXTPRESS_SRC_DIR:-/opt/nextpress-src}"
REPO_URL="${NEXTPRESS_SRC_REPO:-https://github.com/kreo2web/nextpress.git}"
BACKUP_ROOT="${NEXTPRESS_BACKUP_ROOT:-/root}"
IMAGE_REPO="husseinkizz/nextpress"
COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_URL="http://127.0.0.1:5000/api/health"
TAG_SUFFIX="-kreo"

VERSION="1.6.0"
BRANCH=""
DRY_RUN=false
REBUILD=false
WITH_EXPORT=false
SKIP_BACKUP=false

BK=""
PREV_TAG=""
TAG=""
NP_CLI=""

say()      { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
step()     { printf '\n\033[1m[%s]\033[0m %s\n' "$1" "$2"; }
ok()       { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn()     { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
die()      { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
	awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
	exit 0
}

on_error() {
	local line="$1"
	printf '\n\033[31m✗ Falló en la línea %s.\033[0m\n' "$line" >&2
	printf '  No se ha borrado ningún dato. Revisa el mensaje de arriba.\n' >&2
	if [ -n "$PREV_TAG" ]; then
		printf '  Rollback de la imagen: NEXTPRESS_VERSION=%s en %s/.env y `docker compose -f %s up -d app caddy`.\n' \
			"$PREV_TAG" "$INSTALL_DIR" "$COMPOSE_FILE" >&2
	fi
	if [ -n "$BK" ] && [ -f "$BK/rollback.sh" ]; then
		printf '  Script listo: %s/rollback.sh\n' "$BK" >&2
	fi
	exit 1
}
trap 'on_error $LINENO' ERR

# ---------------------------------------------------------------- argumentos

while [ "$#" -gt 0 ]; do
	case "$1" in
		--version|--branch)
			case "$1" in
				--version) [ -n "${2:-}" ] || die "Falta el valor de --version (X.Y.Z)" ; VERSION="$2" ;;
				--branch)  [ -n "${2:-}" ] || die "Falta el valor de --branch <rama>" ; BRANCH="$2" ;;
			esac
			shift 2
			;;
		--rebuild)      REBUILD=true; shift ;;
		--with-export)  WITH_EXPORT=true; shift ;;
		--skip-backup)  SKIP_BACKUP=true; shift ;;
		--dry-run)      DRY_RUN=true; shift ;;
		-h|--help)      usage ;;
		*)              die "Opción desconocida: $1 (usa --help)" ;;
	esac
done

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Versión inválida: '$VERSION' (formato X.Y.Z)"
[ -n "$BRANCH" ] || BRANCH="local/kreotuweb-${VERSION%.*}"
TAG="${IMAGE_REPO}:beta-v${VERSION}${TAG_SUFFIX}"

# ---------------------------------------------------------------- utilidades

need_root() {
	[ "$(id -u)" -eq 0 ] || die "Ejecuta como root: sudo bash $0"
}

check_tools() {
	local t
	for t in docker git gzip awk; do
		command -v "$t" >/dev/null 2>&1 || die "Falta '$t'. Instálalo y vuelve a intentarlo."
	done
	docker compose version >/dev/null 2>&1 || die "Falta 'docker compose' (v2)."
	NP_CLI="${NEXTPRESS_CLI:-$(command -v nextpress || true)}"
	[ -n "$NP_CLI" ] && [ -x "$NP_CLI" ] \
		|| die "No encuentro el comando 'nextpress'. Instala el CLI oficial o pásalo en NEXTPRESS_CLI."
	[ -f "$INSTALL_DIR/$COMPOSE_FILE" ] || die "No existe $INSTALL_DIR/$COMPOSE_FILE"
	[ -f "$INSTALL_DIR/.env" ] || die "No existe $INSTALL_DIR/.env"
}

compose() { ( cd "$INSTALL_DIR" && docker compose -f "$COMPOSE_FILE" "$@" ); }

free_mb() { df -Pm "$1" 2>/dev/null | awk 'NR==2 {print $4}'; }

read_env_tag() {
	awk -F= '/^NEXTPRESS_VERSION=/{print substr($0, index($0, "=") + 1); exit}' "$INSTALL_DIR/.env" 2>/dev/null || true
}

host_arch() {
	case "$(uname -m)" in
		aarch64|arm64) echo arm64 ;;
		x86_64|amd64)  echo amd64 ;;
		*)             uname -m ;;
	esac
}

check_host() {
	local mem_kb swap_kb total_gb
	mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
	swap_kb="$(awk '/SwapTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
	total_gb=$(( (mem_kb + swap_kb) / 1024 / 1024 ))
	printf '  Arquitectura: %s (imagen nativa) · RAM+swap: %s GB\n' "$(uname -m)" "$total_gb"
	if [ "$total_gb" -lt 4 ]; then
		warn "Menos de 4 GB de RAM+swap: el build puede morir por falta de memoria."
		warn "Añade swap antes de continuar (sección ARM del plan)."
	fi
}

check_space() {
	local install_free docker_root docker_free
	local need_install=1024 need_docker=6144
	install_free="$(free_mb "$INSTALL_DIR")"
	docker_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"
	docker_free="$(free_mb "$docker_root")"

	printf '  Espacio libre: %s MB en %s, %s MB en %s\n' "$install_free" "$INSTALL_DIR" "$docker_free" "$docker_root"
	[ -n "$install_free" ] && [ -n "$docker_free" ] || die "No pude leer el espacio libre."

	if [ "$install_free" -lt "$need_install" ]; then
		die "Necesito ≥ ${need_install} MB libres en $INSTALL_DIR (hay ${install_free} MB). Libera espacio y reintenta."
	fi
	if [ "$docker_free" -lt "$need_docker" ]; then
		die "Necesito ≥ ${need_docker} MB libres para Docker en $docker_root (hay ${docker_free} MB)."
	fi
	ok "Espacio suficiente"
}

wait_for_postgres() {
	local i
	compose up -d postgres >/dev/null
	for i in $(seq 1 30); do
		if compose exec -T postgres psql -U postgres -d nextpress -c 'SELECT 1' >/dev/null 2>&1; then
			ok "Postgres acepta consultas"
			return 0
		fi
		sleep 2
	done
	die "Postgres no respondió. Revisa: docker compose logs postgres"
}

find_uploads_volume() {
	local project vol
	if [ -n "${NEXTPRESS_UPLOADS_VOLUME:-}" ]; then
		printf '%s\n' "$NEXTPRESS_UPLOADS_VOLUME"
		return 0
	fi
	project="$(basename "$INSTALL_DIR")"
	vol="$(docker volume ls --format '{{.Name}}' | grep -E "^${project}_uploads$" | head -n1 || true)"
	[ -n "$vol" ] || vol="$(docker volume ls --format '{{.Name}}' | grep -E '(^|_)uploads$' | head -n1 || true)"
	printf '%s\n' "$vol"
}

# ---------------------------------------------------------------- respaldo

write_rollback_script() {
	local prev="$1"
	local rollback_image="nextpress-rollback:${prev}"
	{
		printf '#!/usr/bin/env bash\n'
		printf '# Rollback generado por vps-upgrade-kreo.sh el %s\n' "$(date -Is)"
		printf 'set -euo pipefail\n'
		printf 'cd %q\n' "$INSTALL_DIR"
		printf 'PREV=%q\n' "$prev"
		printf '# El CLI borra las demás imágenes husseinkizz/nextpress al actualizar;\n'
		printf '# la anterior se conserva como %s y aquí se vuelve a etiquetar.\n' "$rollback_image"
		printf 'if docker image inspect %q >/dev/null 2>&1; then\n' "$rollback_image"
		printf '  docker tag %q %q\n' "$rollback_image" "$IMAGE_REPO:$prev"
		printf 'fi\n'
		printf 'sed -i "s/^NEXTPRESS_VERSION=.*/NEXTPRESS_VERSION=$PREV/" .env\n'
		printf 'docker compose -f %q up -d app caddy\n' "$COMPOSE_FILE"
		# Comando de salud legible y válido: comillas simples para el shell, dobles para JS.
		printf "docker compose -f %s exec -T app node -e 'fetch(\"%s\").then(r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(()=>process.exit(1))'\n" \
			"$COMPOSE_FILE" "$HEALTH_URL"
		printf 'echo "Rollback a $PREV completado."\n'
		printf '\n# Restauración completa (solo si los datos estuvieran mal):\n'
		printf '# cd %q\n' "$INSTALL_DIR"
		printf '# docker compose -f %q stop app\n' "$COMPOSE_FILE"
		printf '# docker compose -f %q exec -T postgres psql -U postgres -d nextpress -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"\n' "$COMPOSE_FILE"
		printf '# gunzip -c %q | docker compose -f %q exec -T postgres psql -U postgres -d nextpress\n' \
			"$BK/db.sql.gz" "$COMPOSE_FILE"
		if [ -n "${UPLOADS_VOL:-}" ]; then
			printf '# docker run --rm -v %q:/data -v %q:/backup alpine tar xzf /backup/uploads.tar.gz -C /data\n' \
				"$UPLOADS_VOL" "$BK"
		fi
	} > "$BK/rollback.sh"
	chmod 700 "$BK/rollback.sh"
}

do_backup() {
	local db_size uploads_size human
	BK="${BACKUP_ROOT%/}/np-backup-$(date +%Y%m%d-%H%M%S)"
	umask 077
	mkdir -p "$BK"

	wait_for_postgres

	printf '  · Base de datos...\n'
	compose exec -T postgres pg_dump -U postgres -d nextpress | gzip > "$BK/db.sql.gz"
	[ -s "$BK/db.sql.gz" ] || die "El dump de la BD quedó vacío."
	gzip -t "$BK/db.sql.gz" || die "El dump de la BD está corrupto."
	db_size="$(stat -c %s "$BK/db.sql.gz")"
	[ "$db_size" -gt 1024 ] || die "El dump de la BD es sospechosamente pequeño (${db_size} bytes)."
	human="$(du -h "$BK/db.sql.gz" | cut -f1)"
	ok "Base de datos ($human)"

	UPLOADS_VOL="$(find_uploads_volume)"
	if [ -z "$UPLOADS_VOL" ]; then
		die "No encontré el volumen de uploads. Pásalo con NEXTPRESS_UPLOADS_VOLUME=<nombre> (ver: docker volume ls)."
	fi
	printf '  · Uploads (%s)...\n' "$UPLOADS_VOL"
	# Se usa la imagen que ya corre: evita depender de un pull de alpine.
	local tar_image="${IMAGE_REPO}:${PREV_TAG}"
	docker image inspect "$tar_image" >/dev/null 2>&1 || tar_image="alpine:3.20"
	docker run --rm -v "$UPLOADS_VOL":/data:ro -v "$BK":/backup \
		"$tar_image" tar czf /backup/uploads.tar.gz -C /data .
	[ -s "$BK/uploads.tar.gz" ] || die "El archivo de uploads quedó vacío."
	tar tzf "$BK/uploads.tar.gz" >/dev/null 2>&1 || die "El tar de uploads está corrupto."
	uploads_size="$(du -h "$BK/uploads.tar.gz" | cut -f1)"
	ok "Uploads ($uploads_size)"

	cp -a "$INSTALL_DIR/.env" "$INSTALL_DIR/$COMPOSE_FILE" "$BK"/
	cp -a "$INSTALL_DIR/nextpress.config.json" "$BK"/ 2>/dev/null || warn "Sin nextpress.config.json en el install"
	cp -a "$INSTALL_DIR/caddy_config" "$BK/caddy_config" 2>/dev/null || warn "Sin caddy_config en el install"
	ok ".env, compose, config y Caddy"

	if [ "$WITH_EXPORT" = true ]; then
		printf '  · Export portable (puede tardar)...\n'
		"$NP_CLI" export --with-media-files --out "$BK/export.json" || warn "El export falló; los respaldos anteriores siguen válidos."
	fi

	write_rollback_script "$PREV_TAG"
	ok "Rollback listo: $BK/rollback.sh"
}

# ---------------------------------------------------------------- imagen

prepare_source() {
	step "4/7" "Código fuente: $BRANCH"
	if [ -d "$SRC_DIR/.git" ]; then
		git -C "$SRC_DIR" fetch --prune origin
		git -C "$SRC_DIR" checkout --force "origin/$BRANCH" >/dev/null 2>&1 \
			|| git -C "$SRC_DIR" checkout --force "$BRANCH"
		git -C "$SRC_DIR" reset --hard "origin/$BRANCH" >/dev/null
	else
		mkdir -p "$(dirname "$SRC_DIR")"
		git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
	fi
	ok "HEAD: $(git -C "$SRC_DIR" log --oneline -1)"
}

build_image() {
	step "5/7" "Imagen $TAG"
	if docker image inspect "$TAG" >/dev/null 2>&1 && [ "$REBUILD" != true ]; then
		warn "La imagen ya existe; se reutiliza (usa --rebuild para reconstruir)."
	else
		docker build -t "$TAG" "$SRC_DIR"
		ok "Construida: $TAG"
	fi

	local schema app_version img_arch
	schema="$(docker run --rm --entrypoint node "$TAG" -e "console.log(require('./nextpress.config.json').schemaVersion)")"
	app_version="$(docker run --rm --entrypoint node "$TAG" -e "console.log(require('./package.json').version)")"
	if [ "$app_version" != "$VERSION" ]; then
		warn "package.json de la rama dice $app_version, esperaba $VERSION (¿rama equivocada?)."
	fi
	img_arch="$(docker image inspect --format '{{.Architecture}}' "$TAG")"
	[ "$img_arch" = "$(host_arch)" ] \
		|| die "La imagen es $img_arch y este servidor es $(host_arch). Se construye en el propio VPS, sin --platform."
	ok "Versión en la imagen: $app_version (schema $schema, arch $img_arch)"
}

# ---------------------------------------------------------------- upgrade

# `nextpress upgrade` borra el resto de imágenes husseinkizz/nextpress antes de
# aplicar la nueva (free_upgrade_disk_space en scripts/nextpress). Se guarda una
# copia con otro nombre para que el rollback sea posible.
preserve_previous_image() {
	local rollback_image="nextpress-rollback:${PREV_TAG}"
	if docker image inspect "${IMAGE_REPO}:${PREV_TAG}" >/dev/null 2>&1; then
		docker tag "${IMAGE_REPO}:${PREV_TAG}" "$rollback_image"
		ok "Imagen anterior preservada como $rollback_image"
	else
		warn "No encuentro ${IMAGE_REPO}:${PREV_TAG}; el rollback dependerá del contenedor actual."
	fi
}

run_upgrade() {
	step "6/7" "Upgrade a $TAG"
	printf '  Comando: NEXTPRESS_SKIP_IMAGE_PULL=true nextpress upgrade --version %s\n' "beta-v${VERSION}${TAG_SUFFIX}"
	( cd "$INSTALL_DIR" && NEXTPRESS_SKIP_IMAGE_PULL=true "$NP_CLI" upgrade --version "beta-v${VERSION}${TAG_SUFFIX}" )
	ok "Upgrade completado"
}

verify() {
	step "7/7" "Verificación"
	local i
	for i in $(seq 1 20); do
		if compose exec -T app node -e "fetch('$HEALTH_URL').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
			ok "Health check OK"
			break
		fi
		[ "$i" -eq 20 ] && die "Health check falló. Rollback: $BK/rollback.sh"
		sleep 3
	done

	printf '\n  Estado:\n'
	compose ps
	printf '\n  Versión en .env: %s\n' "$(read_env_tag)"
	printf '  update-helper: '
	"$NP_CLI" update-helper status 2>/dev/null || printf 'desconocido\n'
}

print_plan() {
	cat <<EOF

Plan (dry-run, sin cambios):

  Install dir : $INSTALL_DIR
  Fuente      : $REPO_URL ($BRANCH)
  Versión     : $VERSION
  Imagen      : $TAG
  Respaldo    : ${BACKUP_ROOT}/np-backup-<fecha>/ (BD, uploads, .env, compose, Caddy)
  Rollback    : <respaldo>/rollback.sh

  1. Comprobar requisitos (arquitectura, RAM) y espacio (≥ 1 GB install, ≥ 6 GB Docker)
  2. Respaldo + verificación del dump
  3. nextpress update-helper off
  4. git clone/fetch de $BRANCH en $SRC_DIR
  5. docker build -t $TAG
  6. NEXTPRESS_SKIP_IMAGE_PULL=true nextpress upgrade --version beta-v${VERSION}${TAG_SUFFIX}
  7. Health check y resumen

Nada se ha modificado.
EOF
}

main() {
	say "NextPress → $VERSION (imagen propia)"
	need_root
	check_tools

	PREV_TAG="$(read_env_tag)"
	[ -n "$PREV_TAG" ] || die "No pude leer NEXTPRESS_VERSION de $INSTALL_DIR/.env"
	printf '  Instalación : %s\n  Tag actual  : %s\n  Tag nuevo   : %s\n  Rama        : %s\n' \
		"$INSTALL_DIR" "$PREV_TAG" "$TAG" "$BRANCH"

	if [ "$DRY_RUN" = true ]; then
		print_plan
		exit 0
	fi

	step "1/7" "Requisitos"
	check_host
	check_space
	ok "Docker, git y CLI presentes"

	step "2/7" "Respaldo"
	if [ "$SKIP_BACKUP" = true ]; then
		warn "Respaldo OMITIDO (--skip-backup)"
		BK="${BACKUP_ROOT%/}/np-backup-skipped-$(date +%Y%m%d-%H%M%S)"
	else
		do_backup
	fi

	step "3/7" "Actualizaciones desde el panel"
	"$NP_CLI" update-helper off
	ok "update-helper off (el panel no puede pisar la imagen propia)"

	prepare_source
	build_image
	preserve_previous_image
	run_upgrade
	verify

	say "Listo: $VERSION con tus parches"
	cat <<EOF

  Respaldo y rollback : $BK
  Imagen              : $TAG
  Versión en .env     : $(read_env_tag)

  Revisa a mano (5 min):
    · /admin y login
    · guardar una página grande desde el builder
    · una página con CSS de bloque en una ruta cliente (/, /page/:slug)
    · favicon en la pestaña
    · una página de docs antigua (1.6 convierte el contenido al guardar)

  Recuerda: el botón "Actualizar" del panel está desactivado a propósito.
  Para la próxima versión: sudo bash $0 --version X.Y.Z --branch local/kreotuweb-X.Y
EOF
}

main "$@"
