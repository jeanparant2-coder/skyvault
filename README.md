# Personal Cloud Web (Docker)

Application web de cloud personnel avec interface moderne (inspiree OneDrive) et stockage persistant.

## Fonctionnalites

- Sidebar + header + vue fichiers
- Vue `grille` et vue `liste`
- Upload multi-fichiers
- Creation de dossier
- Renommage
- Suppression (fichier ou dossier)
- Recherche
- Stockage persistant via volume Docker

## Prerequis

- Docker
- Docker Compose (commande `docker compose`)

## Lancement

```bash
docker compose up --build -d
```

Puis ouvre: `http://localhost:8080`

## Arret

```bash
docker compose down
```

## Persistance

Les fichiers sont conserves dans le volume nomme `cloud_storage`.

## Variables utiles

- `PORT` (defaut `3000`)
- `STORAGE_ROOT` (defaut `/data/storage` dans le conteneur)
- `STORAGE_CAPACITY_BYTES` (defaut `21474836480`, soit 20 Go)
- `MAX_UPLOAD_SIZE_MB` (defaut `200`)
