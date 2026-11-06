# Plan: actualizar NextPress del VPS a 1.6 sin perder datos ni parches

> Estado verificado en el repo local el 2026-11-06.
> Rama instalada: `local/kreotuweb` = **v1.5.0 + 4 parches propios**
> Rama nueva: `local/kreotuweb-1.6` = **v1.6.0 + los mismos 4 parches**

## Resumen técnico

| Dato | Valor |
|---|---|
| Commits upstream 1.5.0 → 1.6.0 | 7 (docs/posts con bloques normales, import de docs, pulido de admin, fix de migración 0002) |
| Migraciones nuevas | **Ninguna** |
| `schemaVersion` | `2026.10.25.001` en ambas versiones → la BD no cambia |
| Dependencias | `pnpm-lock.yaml` idéntico; solo cambia `version` en `package.json` |
| Parches propios | 6 archivos, +39/−5 |
| Typecheck de la rama nueva | limpio |

Parches que deben sobrevivir (todos incluidos en `local/kreotuweb-1.6`):

1. `client/src/components/PageBuilder/public-block-stack.tsx` — emite `customCss` de bloques en rutas cliente.
2. `server/routes/index.ts` — límite JSON/urlencoded de 2 MB para guardar páginas grandes.
3. `server/index.ts` — `reusePort` desactivado en win32 (inerte en Linux, se mantiene).
4. `shared/published-document-meta.ts`, `server/lib/send-published-html.ts`, `server/routes/shared/build-published-page-html.ts` — favicon del sitio en el HTML publicado.

Consecuencia: el riesgo sobre los datos es mínimo y el rollback es prácticamente cambiar la imagen. El riesgo real es que el actualizador del panel (`update-helper`) apunta al registro oficial `husseinkizz/nextpress` y **reemplazaría la imagen por una sin parches**.

## Decisión de diseño

No se usa `nextpress upgrade --latest` ni el botón "Actualizar ahora" del panel.
Se construye una **imagen propia** desde la rama con parches y se etiqueta localmente como
`husseinkizz/nextpress:beta-v1.6.0-kreo`, que es el nombre que el CLI resuelve
(`app_image()` en `scripts/nextpress`). Así se conservan el respaldo automático, la
comprobación de esquema y el health check del CLI, sin publicar nada en Docker Hub.

El tag `beta-v1.6.0-kreo` es distinto del oficial `beta-v1.6.0`: no hay ambigüedad.

---

## VPS ARM (aarch64)

Tu VPS es ARM y la imagen se construye **en el propio VPS**. Es lo correcto:

- `node:24.22.1-alpine` es multi-arquitectura: en un host arm64 Docker usa la variante arm64.
- El build es nativo. **No** pases `--platform linux/amd64`: sería emulación lenta y la imagen
  resultante no coincidiría con el host.
- La imagen queda como `linux/arm64`: vale para este VPS y para otro ARM, **no** para un
  servidor amd64. Si algún día migras, se reconstruye.

Comprobaciones antes de construir:

```bash
uname -m                                   # aarch64
docker info --format '{{.Architecture}}'   # arm64
docker buildx inspect --bootstrap | grep -i platform
```

Requisitos reales en ARM:

| Recurso | Mínimo | Recomendado |
|---|---|---|
| Disco para Docker | 6 GB | 8 GB |
| RAM + swap | 4 GB | 6 GB |
| Tiempo de build | 10 min | 30 min según núcleos |

El build ocurre **antes** del upgrade: la web sigue arriba mientras compila.

Si hay poca RAM, añade swap una vez:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Verificar que la imagen es arm64:

```bash
docker image inspect --format '{{.Os}}/{{.Architecture}}' \
  husseinkizz/nextpress:beta-v1.6.0-kreo      # linux/arm64
```

El script `vps-upgrade-kreo.sh` comprueba arquitectura host vs imagen (aborta si no coinciden)
y avisa si RAM+swap < 4 GB.


---

## Paso 0 — Preparar la rama (PC local)

La rama no está publicada en el fork, así que el VPS no puede clonarla todavía.

```bash
git status                     # limpio
pnpm check                     # ya validado: 0 errores
git push -u myfork local/kreotuweb-1.6
```

Verificar que el remoto termina en `2f1e85f` y que solo difieren tus 6 archivos:

```bash
git log --oneline -5 myfork/local/kreotuweb-1.6
git diff --stat v1.6.0 myfork/local/kreotuweb-1.6
```

## Paso 1 — Inventario en el VPS (solo lectura)

```bash
ssh root@TU_VPS
cd /opt/nextpress

sudo nextpress status
sudo nextpress update-helper status
grep '^NEXTPRESS_VERSION=' .env        # tag actual, necesario para el rollback
sudo docker compose -f docker-compose.prod.yml ps
sudo docker images | grep -i nextpress
sudo docker volume ls | grep -i uploads
df -h / ; sudo docker system df
```

Anotar: **tag actual**, nombre del volumen (`<proyecto>_uploads`) y espacio libre.
Para construir hacen falta **≥ 6 GB libres para Docker** (el CLI exige 1 GB en el install y
2 GB en Docker, más el build) y **≥ 4 GB de RAM+swap**. En ARM, ver la sección anterior.

## Paso 2 — Triple respaldo (fuera de `/opt/nextpress`)

```bash
TS=$(date +%Y%m%d-%H%M%S); BK=/root/np-backup-$TS; mkdir -p $BK
cd /opt/nextpress

# 1) Base de datos
sudo docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres -d nextpress | gzip > $BK/db.sql.gz

# 2) Archivos subidos (volumen docker, no carpeta)
#    alpine se descarga la primera vez; también vale la imagen que ya corre:
#    docker run --rm -v "$VOL":/data:ro -v "$BK":/backup husseinkizz/nextpress:$PREV tar czf ...
VOL=$(sudo docker volume ls --format '{{.Name}}' | grep '_uploads$' | head -n1)
sudo docker run --rm -v "$VOL":/data:ro -v "$BK":/backup alpine \
  tar czf /backup/uploads.tar.gz -C /data .

# 3) Configuración del servidor
sudo cp .env docker-compose.prod.yml nextpress.config.json $BK/
sudo cp -a caddy_config $BK/caddy_config

# 4) Export portable (capa extra, independiente de la BD)
sudo nextpress export --with-media-files --out $BK/export.json

ls -lh $BK
gunzip -t $BK/db.sql.gz && echo "dump OK"
```

Guardar el respaldo **fuera de `/opt/nextpress`**: `nextpress upgrade` poda backups viejos
(`BACKUP_KEEP_COUNT=3`).

## Paso 3 — Apagar actualizaciones desde el panel

```bash
sudo nextpress update-helper off
sudo nextpress update-helper status     # off
```

`off` crea `/opt/nextpress/.update-helper-off`; `nextpress upgrade` respeta ese archivo y no
vuelve a activar el servicio. Si se reactivara, el botón del panel instalaría la imagen oficial
`latest` y se perderían los parches.

## Paso 4 — Construir la imagen propia

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone --branch local/kreotuweb-1.6 \
  https://github.com/kreo2web/nextpress.git /opt/nextpress-src
cd /opt/nextpress-src
git log --oneline -5                    # 2f1e85f en la cabeza

sudo docker build -t husseinkizz/nextpress:beta-v1.6.0-kreo .
```

Comprobaciones sin arrancar la app:

```bash
sudo docker run --rm --entrypoint node husseinkizz/nextpress:beta-v1.6.0-kreo \
  -e "console.log(require('./nextpress.config.json').schemaVersion)"   # 2026.10.25.001
sudo docker run --rm --entrypoint node husseinkizz/nextpress:beta-v1.6.0-kreo \
  -e "console.log(require('./package.json').version)"                  # 1.6.0
sudo docker image inspect --format '{{.Os}}/{{.Architecture}}' \
  husseinkizz/nextpress:beta-v1.6.0-kreo                               # linux/arm64
```

La imagen se construye **en el VPS**. No la construyas en tu PC (amd64) ni la copies: sería
otra arquitectura y no arrancaría.

Respaldo opcional del artefacto en tu propio Docker Hub:

```bash
sudo docker tag husseinkizz/nextpress:beta-v1.6.0-kreo kreo2web/nextpress:beta-v1.6.0-kreo
sudo docker login
sudo docker push kreo2web/nextpress:beta-v1.6.0-kreo
```

**Preserva la imagen actual antes de actualizar.** `prepare_upgrade_workspace` llama a
`free_upgrade_disk_space()`, que **borra el resto de imágenes `husseinkizz/nextpress`**
(`rmi` sobre todo lo que no sea el tag destino). Sin este paso el rollback por imagen puede
no estar disponible:

```bash
PREV=beta-v1.5.0        # el tag del paso 1
sudo docker tag husseinkizz/nextpress:$PREV nextpress-rollback:$PREV
```

`nextpress-rollback:*` no cae en ese `rmi` porque el filtro es por repositorio
`husseinkizz/nextpress`. El script `vps-upgrade-kreo.sh` lo hace solo.

## Paso 5 — Ejecutar la actualización

```bash
cd /opt/nextpress
sudo env NEXTPRESS_SKIP_IMAGE_PULL=true nextpress upgrade --version beta-v1.6.0-kreo
```

Qué hace, en orden:

1. Bloquea upgrades concurrentes (`flock`).
2. Comprueba espacio y libera backups viejos.
3. **No** hace `docker pull` → usa la imagen local.
4. Compara `schemaVersion`: igual → **no toca la BD** ("Schema is already at …").
5. Escribe `NEXTPRESS_VERSION=beta-v1.6.0-kreo` en `.env`.
6. Re-ejecuta el seed idempotente (plantillas/temas por defecto si faltan).
7. `docker compose up -d` + health check de `/api/health`; si falla, aborta sin tocar datos.
8. Deja `update-helper` en off.

## Paso 6 — Verificación

```bash
curl -fsS https://TU_DOMINIO/api/health
sudo nextpress status
sudo docker compose -f docker-compose.prod.yml logs app --tail 80 | grep -iE "error|fail" || echo "sin errores"
```

| # | Qué | Cómo | Esperado |
|---|---|---|---|
| 1 | Panel y login | abrir `/admin` | carga, sesión válida (mismo `SESSION_SECRET`) |
| 2 | Versión | notas de versión del panel | 1.6.0 |
| 3 | Datos | abrir 3–4 páginas y posts | contenido y medios intactos |
| 4 | Parche 2 MB | guardar una página grande desde el builder | guarda sin error 413 |
| 5 | Parche customCss | `curl -s https://dominio/page/SLUG \| grep -c "tu-regla"` | aparece el CSS del bloque |
| 6 | Favicon (SPA) | `curl -s https://dominio/ \| grep 'rel="icon"'` | etiqueta presente |
| 7 | Favicon (SSR) | `curl -s https://dominio/sites/.../pagina \| grep 'rel="icon"'` | presente también |
| 8 | Docs 1.6 | abrir una página de **docs** antigua y guardar | se convierte a bloques normales sin perder texto |
| 9 | Imágenes | página con galería | se ven (volumen `uploads` intacto) |

El parche de `reusePort` es solo Windows: en Linux es inerte.

## Paso 7 — Cierre

```bash
cd /opt/nextpress
grep '^NEXTPRESS_VERSION=' .env          # beta-v1.6.0-kreo
sudo nextpress update-helper status      # off
sudo docker image prune -f               # opcional, tras validar
```

Dejar `/opt/nextpress-src` en el VPS: es la fuente para la próxima actualización.
Anotar: *"NextPress del VPS = rama `local/kreotuweb-X.Y`, imagen propia `beta-vX.Y.Z-kreo`;
nunca actualizar con el botón del panel ni con `nextpress upgrade --latest`"*.

## Rollback

Los datos no cambiaron: basta volver a la imagen anterior.

```bash
cd /opt/nextpress
PREV=beta-v1.5.0        # el tag anotado en el paso 1

# El CLI borra las demás imágenes husseinkizz/nextpress: primero re-etiqueta la copia.
sudo docker tag nextpress-rollback:$PREV husseinkizz/nextpress:$PREV

sudo sed -i "s/^NEXTPRESS_VERSION=.*/NEXTPRESS_VERSION=$PREV/" .env
sudo docker compose -f docker-compose.prod.yml up -d app caddy
curl -fsS https://TU_DOMINIO/api/health
```

Si la copia no existiera (`nextpress-rollback:$PREV`), aún puedes volver a la imagen oficial
anterior o reconstruirla desde la rama con parches:

```bash
cd /opt/nextpress-src && git checkout v1.5.0   # o la rama local/kreotuweb
sudo docker build -t husseinkizz/nextpress:$PREV .
```

Solo si el health sigue fallando o hay datos raros:

```bash
sudo docker compose -f docker-compose.prod.yml stop app
sudo docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d nextpress -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c /root/np-backup-FECHA/db.sql.gz | \
  sudo docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d nextpress
# uploads: mismo docker run ... tar xzf sobre el volumen
```

## Riesgos

1. **`update-helper`**: si se reactiva, instala la imagen oficial y desaparecen los parches.
2. **Nunca `nextpress upgrade` a secas** (equivale a `--latest` oficial): siempre con la imagen
   propia construida antes y `--version beta-vX.Y.Z-kreo`.
3. **`nextpress upgrade` borra las demás imágenes `husseinkizz/nextpress`** (`free_upgrade_disk_space`)
   y poda `backups/nextpress-db-*.sql` dejando 3. Por eso el respaldo va a `/root` y la imagen
   anterior se guarda como `nextpress-rollback:<tag>`.
4. **1.6 elimina el editor MDX/markdown de docs y posts.** No borra contenido:
   `convertLegacyProse` convierte `docs/text|heading|list` al leer y al guardar. Revisar una
   página de docs antigua antes de cerrar.
5. **Nunca `docker compose down -v`**: `-v` borra `db_data` y `uploads`.
6. **`uploads` es un volumen nombrado**: se copia con `tar` en un contenedor, no con `cp`.
7. **Ventana**: ~5–10 min de panel caído (el build va aparte, ~3–6 min según el VPS).

---

## Automatización

`scripts/vps-upgrade-kreo.sh` ejecuta los pasos 1–7 con respaldo previo, construcción de la
imagen y verificación, y deja un `rollback.sh` junto al respaldo. Preserva la imagen anterior
como `nextpress-rollback:<tag>` antes de que el CLI la borre. Comprueba arquitectura host vs
imagen y avisa si RAM+swap < 4 GB.

Validado en local: `bash -n` limpio y una ejecución simulada completa (docker/git/nextpress
falsos) con los 7 pasos en verde.

```bash
# desde tu PC
scp scripts/vps-upgrade-kreo.sh root@TU_VPS:/root/

# en el VPS
sudo bash /root/vps-upgrade-kreo.sh --dry-run     # muestra el plan sin tocar nada
sudo bash /root/vps-upgrade-kreo.sh               # 1.6.0 desde local/kreotuweb-1.6
sudo bash /root/vps-upgrade-kreo.sh --version 1.7.0 --branch local/kreotuweb-1.7
```
