#!/bin/bash
docker stop tgdrive || true
docker rm tgdrive || true
docker build -t tgdrive .
docker run -d --name tgdrive \
    --restart unless-stopped \
    -p 80:8000 \
    -v $(pwd)/cache:/app/cache \
    tgdrive