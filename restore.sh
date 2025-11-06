docker cp ./backups/backup.dump Oasis_2025-postgres:/backup.dump
# pg_restore  -U postgres -d postgres --create --clean --if-exists -j 4 backup.sql
docker exec Oasis_2025-postgres pg_restore -U postgres -d postgres --clean --if-exists -j 4 /backup.dump
