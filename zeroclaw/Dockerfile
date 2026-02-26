FROM debian:trixie-slim

ARG ZEROCLAW_VERSION=0.1.7

# Install minimal dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Inject corporate CA bundle (proxy SSL intercept)
COPY ca-bundle.pem /usr/local/share/ca-certificates/corporate-ca.crt
RUN update-ca-certificates

# Download and install zeroclaw binary (v0.1.7+)
RUN curl -fsSL "https://github.com/zeroclaw-labs/zeroclaw/releases/download/v${ZEROCLAW_VERSION}/zeroclaw-x86_64-unknown-linux-gnu.tar.gz" \
    -o /tmp/zeroclaw.tar.gz && \
    tar xz -C /usr/local/bin/ -f /tmp/zeroclaw.tar.gz && \
    chmod +x /usr/local/bin/zeroclaw && \
    rm -f /tmp/zeroclaw.tar.gz

# Version integrity check — update SHA256 when upgrading ZEROCLAW_VERSION
# To get the hash: sha256sum /tmp/zeroclaw.tar.gz
# ARG ZEROCLAW_SHA256="UPDATE_ON_UPGRADE"
# RUN echo "$ZEROCLAW_SHA256  /tmp/zeroclaw.tar.gz" | sha256sum -c -

# Create non-root user
RUN useradd -m -s /bin/bash zeroclaw
USER zeroclaw
WORKDIR /home/zeroclaw

# Config and data directories
RUN mkdir -p /home/zeroclaw/.zeroclaw/data

ENTRYPOINT ["zeroclaw"]
CMD ["daemon"]
