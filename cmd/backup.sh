psql -U postgres
docker exec Oasis_2025-postgres pg_dump -U postgres -Fc -f backup.dump postgres

docker cp Oasis_2025-postgres:/backup.dump ./backups/backup_$(date +%Y%m%d_%H%M%S).dump