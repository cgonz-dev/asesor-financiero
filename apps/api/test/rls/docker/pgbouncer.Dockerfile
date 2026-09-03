FROM alpine:3.24.1 AS build

ARG PGBOUNCER_TAG=pgbouncer_1_25_2

RUN apk add --no-cache \
    autoconf \
    automake \
    c-ares-dev \
    gcc \
    git \
    libc-dev \
    libevent-dev \
    libtool \
    make \
    openssl-dev \
    pkgconfig \
  && git clone --depth 1 --branch "${PGBOUNCER_TAG}" --recurse-submodules \
       https://github.com/pgbouncer/pgbouncer.git /tmp/pgbouncer \
  && cd /tmp/pgbouncer \
  && ./autogen.sh \
  && ./configure --prefix=/usr \
  && make -j2 pgbouncer \
  && install -m 0755 pgbouncer /usr/bin/pgbouncer

FROM alpine:3.24.1

RUN apk add --no-cache c-ares libevent libssl3 postgresql-client \
  && mkdir -p /etc/pgbouncer /var/run/pgbouncer \
  && chown -R postgres:postgres /etc/pgbouncer /var/run/pgbouncer

COPY --from=build /usr/bin/pgbouncer /usr/bin/pgbouncer
COPY entrypoint.sh /usr/local/bin/rls-pgbouncer-entrypoint.sh

RUN chmod 0755 /usr/local/bin/rls-pgbouncer-entrypoint.sh

USER postgres
EXPOSE 6432
ENTRYPOINT ["/usr/local/bin/rls-pgbouncer-entrypoint.sh"]
