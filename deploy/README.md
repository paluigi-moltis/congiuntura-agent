# Deploying congiuntura-agent

Static bundle — a tiny nginx container serves `site/`. Deploy on the same host as
congiuntura-live (<prod-host IP>), behind the existing openresty.

## 1. Container

```yaml
# add to the host's compose stack
  congiuntura-agent:
    image: nginx:alpine
    container_name: congiuntura-agent
    restart: unless-stopped
    volumes:
      - ./site:/usr/share/nginx/html:ro
      - ./nginx-default.conf:/etc/nginx/conf.d/default.conf:ro
    # no ports published — openresty proxies to it over the compose network
```

## 2. nginx config (`nginx-default.conf`)

```nginx
server {
    listen 80;
    server_name congiuntura-agent.by.gg8.eu;
    root /usr/share/nginx/html;

    # Public agent artifacts must be readable cross-origin (MVP spec §3.3)
    location ~ ^/(agent-manifest\.json|congiuntura_outlook\.network\.json|links\.json|agent-mcp\.json)$ {
        add_header Access-Control-Allow-Origin "*" always;
    }
    location ~ ^/\.well-known/ {
        add_header Access-Control-Allow-Origin "*" always;
    }

    # The sandbox worker runs in an isolated worker (MVP spec: coded-tool isolation)
    location = /runtime/sandbox-worker.js {
        add_header Content-Security-Policy "default-src 'none'; script-src blob:; connect-src 'none'; worker-src 'none'" always;
    }

    # bridge/ must be frameable by other agent sites: no X-Frame-Options
    location /bridge/ { add_header Cache-Control "no-cache"; }

    add_header Cache-Control "no-cache" always;  # bundle changes often during the hackathon
}
```

## 3. openresty

New vhost/server block: `congiuntura-agent.by.gg8.eu` → `proxy_pass http://congiuntura-agent:80;`
(HTTPS via the same certificates as the main site — the spec REQUIRES HTTPS in production).

## 4. DNS

`congiuntura-agent.by.gg8.eu` → A/AAAA/CNAME → the host.

## 5. MCP CORS (already done in Phase 1)

The dashboard and the agents fetch `https://congiuntura.by.gg8.eu/mcp`, whose CORS
already allows `https://congiuntura-agent.by.gg8.eu` + localhost dev. Verify after deploy:

```bash
curl -s -H 'Origin: https://congiuntura-agent.by.gg8.eu' -i https://congiuntura.by.gg8.eu/mcp \
  -X OPTIONS -H 'Access-Control-Request-Method: POST' | grep access-control-allow-origin
```

## "Otari later" switch (BYOK-first → funded default)

The manifest ships BYOK-first: visitors add their own key (OpenRouter/Otari/OpenAI-compatible).
To fund visitors' calls later with hosted Otari, change ONE file (`agent-manifest.json`):

```json
"llm_router": {
  "base_url": "https://api.otari.ai/api/v1",
  "publisher_funded": true,
  "mock": false,
  "byok_router": "https://api.otari.ai/api/v1"
}
```

- `publisher_funded: true` → the runtime calls Otari with no key (needs a funded Otari
  key behind a small CORS-allowing proxy you control — see the skill's
  `references/bundle_and_hosting.md`, "Paying for visitors' model calls")
- `byok_router` stays a DIFFERENT URL from `base_url` (the build refuses a match):
  point `byok_router` at e.g. your Otari EU endpoint when you do this
- The visitor's own key always takes precedence and is never sent to `base_url`
- No network/runtime/dashboard change needed — rebuild not required (manifest is read at runtime)

Keep `llm_config.model_name` in the HOCON in sync with the router's models.
