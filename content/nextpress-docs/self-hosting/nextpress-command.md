---
title: The nextpress command
description: Install, upgrade, check and repair your NextPress server with the nextpress command.
slug: nextpress-command
kind: page
order: 1
---

The installer adds the `nextpress` command to your server, at `/usr/local/bin/nextpress`. Use it to install and upgrade NextPress, check its services, read its logs, and export your data. Run `nextpress help` to see the commands on your server.

## Commands

| Command | What it does |
|---|---|
| `nextpress install` | Sets up NextPress: writes the settings, starts the database, runs the migrations, and starts the app and Caddy |
| `nextpress upgrade` | Moves to the latest version, or to the version you give with `--version` |
| `nextpress status` | Shows each service and whether it is running |
| `nextpress logs` | Follows the logs of all services. Add service names, such as `app` or `postgres caddy`, to follow only those |
| `nextpress restart` | Restarts all services |
| `nextpress reload` | Reloads Caddy |
| `nextpress export` | Writes your site data to a file |
| `nextpress import` | Brings the data in a file back into NextPress |
| `nextpress update-helper` | Turns one-click updates from the dashboard on, off, or shows whether they are on |
| `nextpress uninstall --yes` | Removes NextPress from the server |
| `nextpress --version` | Prints the version of the command |

## Use another folder

NextPress keeps its files in `/opt/nextpress`. To use another folder, add `--install-dir`, or its short form `-d`, before the command:

```bash title="Check the status of an install in your home folder"
nextpress --install-dir "$HOME/nextpress" status
```

## Install and upgrade

To install a particular version, pass its tag:

```bash title="Install a version"
nextpress install --version beta-v1.0.2
```

To upgrade, see [Upgrade](/docs/getting-started/upgrade). It covers the backup, the disk space check and the override option.

## Check and repair services

Run `nextpress status` to see whether each service is running. If something looks wrong, read its logs:

```bash title="Follow the logs of the app and the database"
nextpress logs app postgres
```

Run `nextpress restart` to restart all services, or `nextpress reload` to reload Caddy after a change to its settings.

## Export and import

`nextpress export` writes your data to a file in the current folder. Import it back with `nextpress import`. See [Back up and move](/docs/self-hosting/back-up-and-move) for the options.

## Settings the command reads

You can set these values in your environment before you run the command:

| Setting | What it does |
|---|---|
| `NEXTPRESS_INSTALL_DIR` | The install folder, when `--install-dir` is not given |
| `NEXTPRESS_COMPOSE_URL` | The address of the setup file the install downloads |
| `NEXTPRESS_PUBLIC_IP` | The public address shown in the install output |
| `NEXTPRESS_SKIP_DOCKER_INSTALL` | When `1`, the installer stops if Docker is missing instead of installing it |

<Callout type="danger" title="Uninstall removes your data">

`nextpress uninstall --yes` stops the services, removes the named volumes that hold the database, and removes the install folder. It removes NextPress images on a best effort basis. Make a backup with `nextpress export` before you run it.

</Callout>
