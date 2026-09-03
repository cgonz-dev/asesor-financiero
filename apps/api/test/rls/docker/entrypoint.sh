#!/bin/sh
set -eu

: "${RLS_SPIKE_APP_PASSWORD:?RLS_SPIKE_APP_PASSWORD is required}"

umask 077
printf '"rls_spike_app" "%s"\n' "${RLS_SPIKE_APP_PASSWORD}" > /etc/pgbouncer/userlist.txt

{
  printf '%s\n' '[databases]'
  printf 'copiloto_rls_spike = host=postgres port=5432 dbname=copiloto_rls_spike user=rls_spike_app password=%s\n' "${RLS_SPIKE_APP_PASSWORD}"
  printf '%s\n' '[pgbouncer]'
  printf '%s\n' 'listen_addr = 0.0.0.0'
  printf '%s\n' 'listen_port = 6432'
  printf '%s\n' 'auth_type = scram-sha-256'
  printf '%s\n' 'auth_file = /etc/pgbouncer/userlist.txt'
  printf '%s\n' 'pool_mode = transaction'
  printf '%s\n' 'default_pool_size = 1'
  printf '%s\n' 'max_db_connections = 1'
  printf '%s\n' 'max_client_conn = 20'
  printf '%s\n' 'max_prepared_statements = 200'
  printf '%s\n' 'ignore_startup_parameters = extra_float_digits'
  printf '%s\n' 'log_connections = 0'
  printf '%s\n' 'log_disconnections = 0'
  printf '%s\n' 'pidfile = /var/run/pgbouncer/pgbouncer.pid'
  printf '%s\n' 'unix_socket_dir = /var/run/pgbouncer'
} > /etc/pgbouncer/pgbouncer.ini

exec /usr/bin/pgbouncer /etc/pgbouncer/pgbouncer.ini

