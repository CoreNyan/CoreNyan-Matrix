# CoreNyan Matrix delivery rules
- This cloud source must be synchronized to the user's local CoreNyan-2026-11-6-backup/CoreNyan-Matrix after every change.
- From E:/LynnH Ma/Progarmming/Misc/CoreNyan-Ubuntu run python scripts/sync-web-from-cloud.py; inspect .cloud-migration/web-sync-latest.json and verify all hashes.
- Back up overwritten local files; preserve local-only files, .git, dependencies and recycle bins. Never force reset/delete local user work.
- Keep /etc/corenyan-web credentials and TLS private keys out of the project and synchronization.
- Do not restart OneBot for Web work. Explain any affected service restart before deployment.

- Runtime-only cloud rule: keep tests, fixtures, screenshots, acceptance reports, temporary probes and change backups locally. Never upload them to cloud project areas. Before removing old artifacts, download and SHA256-verify them locally. Preserve runtime/user data and recycle bins. Gitignore does not filter deployments; maintain Docker/deploy exclusions too.

- Public application name: CoreNyan; repository: CoreNyan-Matrix. Web, Windows and Android use the shared frontend/web UI. Keep all three platforms compatible when changing UI or APIs.
- Canonical deployed directory: /opt/corenyan/corenyan-matrix. frontend/server.mjs serves HTTPS and proxies backend/server.js over the private Docker network.
- Unified endpoint and public certificate are configured in contracts/product.json; prepare native configs with node tools/prepare-apps.mjs. Private signing keys stay in ignored local .signing/.
- Keep native builds, SDKs and release artifacts local. Do not publish a repository Release until the user supplies the new repository.

## GitHub Pages and three-way source synchronization (2026-11-12)
- Public repository is https://github.com/CoreNyan/CoreNyan-Matrix, branch main. After every Matrix change, synchronize runtime source between cloud and local, verify hashes, then commit/push reviewed public source and verify Pages deployment. Do not stop at cloud/local sync.
- Public Web is https://corenyan.fun on GitHub Pages; API stays HTTPS IP direct via contracts/product.json. Cloud static frontend remains the native compatibility origin and TLS API proxy. Pages uses origin-allowlisted bearer sessions; native clients retain same-origin cookies. All identities/settings/chat remain cloud-authoritative.
- Publish only explicit core-source allowlists. Never publish private backend config, uploads, credentials, tokens, session stores, signing keys, tests, temporary files, build outputs or old unaudited history. Preserve legacy Git locally. Runtime configs and mutable state are excluded from Git.
- IP TLS uses a publicly trusted short-lived certificate with automated renewal and in-process reload. Keep private keys outside the repository. Do not restart OneBot for Pages, TLS, or Matrix work.
