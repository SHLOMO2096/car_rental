content = """\
#
# Differences vs docker-compose.yml (local dev):
#  - Traefik edge proxy is provided by infra-proxy-dev - this stack no longer owns ports 80/443
#  - frontend: built with Dockerfile.prod (static nginx, not Vite dev-server)
#  - backend:  no --reload, no volume mount
#  - TLS:      Let's Encrypt Staging (handled by infra-proxy-dev Traefik)
#
# Prerequisites:
#   1. infra-proxy-dev must already be running and have created the traefik-public network
#   2. DNS: dev.waycar.co.il -> dev server IP

services:

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        VITE_API_URL: /api
    volumes: []
    ports: []
    command: []
    networks:
      - car_rental_internal
      - traefik-public
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik-public
      - "traefik.http.routers.car-rental-dev-web.rule=Host(`dev.waycar.co.il`)"
      - traefik.http.routers.car-rental-dev-web.entrypoints=websecure
      - traefik.http.routers.car-rental-dev-web.tls.certresolver=letsencrypt
      - traefik.http.routers.car-rental-dev-web.priority=1
      - traefik.http.routers.car-rental-dev-web.middlewares=default-chain@file
      - traefik.http.services.car-rental-dev-web.loadbalancer.server.port=80

  backend:
    volumes: []
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000
    networks:
      - car_rental_internal
      - traefik-public
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik-public
      - "traefik.http.routers.car-rental-dev-api.rule=Host(`dev.waycar.co.il`) && PathPrefix(`/api`)"
      - traefik.http.routers.car-rental-dev-api.entrypoints=websecure
      - traefik.http.routers.car-rental-dev-api.tls.certresolver=letsencrypt
      - traefik.http.routers.car-rental-dev-api.priority=100
      - traefik.http.services.car-rental-dev-api.loadbalancer.server.port=8000
      - "traefik.http.routers.car-rental-dev-login.rule=Host(`dev.waycar.co.il`) && Path(`/api/auth/login`)"
      - traefik.http.routers.car-rental-dev-login.entrypoints=websecure
      - traefik.http.routers.car-rental-dev-login.tls.certresolver=letsencrypt
      - traefik.http.routers.car-rental-dev-login.priority=200
      - traefik.http.routers.car-rental-dev-login.service=car-rental-dev-api
      - "traefik.http.routers.car-rental-dev-health.rule=Host(`dev.waycar.co.il`) && Path(`/health`)"
      - traefik.http.routers.car-rental-dev-health.entrypoints=websecure
      - traefik.http.routers.car-rental-dev-health.tls.certresolver=letsencrypt
      - traefik.http.routers.car-rental-dev-health.priority=150
      - traefik.http.routers.car-rental-dev-health.service=car-rental-dev-api

networks:
  traefik-public:
    external: true
    name: traefik-public
"""

with open("docker-compose.dev-server.yml", "w", newline="\n") as f:
    f.write(content)

print("Written successfully")

