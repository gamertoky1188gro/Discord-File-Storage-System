ls
npm run dev
cat server/index.ts 
micro server/db.ts 
apt update && apt install postgresql postgresql-contrib
service postgresql start
su - postgres
chown -R postgres:postgres /var/lib/postgresql/16/main
chmod 640 /etc/ssl/private/ssl-cert-snakeoil.key
chown root:ssl-cert /etc/ssl/private/ssl-cert-snakeoil.key
su - postgres
service postgresql start
exit
