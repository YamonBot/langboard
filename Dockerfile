FROM python:3.12 AS base

WORKDIR /app

ENV PIP_DISABLE_PIP_VERSION_CHECK=on
ENV UV_HTTP_TIMEOUT=120

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        libssl-dev \
        libuv1-dev \
        systemd \
        tar \
    && rm -rf /var/lib/apt/lists/*

ADD https://astral.sh/uv/install.sh /uv-installer.sh

RUN sh /uv-installer.sh && rm /uv-installer.sh

ENV PATH="/root/.local/bin/:$PATH"

RUN uv --version

COPY ./src/api ./src/api
COPY ./src/shared/py ./src/shared/py
COPY pyproject.toml uv.lock README.md alembic.ini ./

RUN cd /app/src/shared/py && uv venv && uv sync
RUN cd /app && uv venv && uv sync

FROM base AS with-cron
ARG CRON_TAB_FILE

RUN apt-get update \
    && apt-get install -y --no-install-recommends cron \
    && rm -rf /var/lib/apt/lists/*
RUN crontab $CRON_TAB_FILE
RUN cron
