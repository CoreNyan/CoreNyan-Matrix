"""Certbot deploy hook. Runtime keys remain outside the repository."""
from pathlib import Path
import os,ssl,shutil
lineage=Path(os.environ.get('RENEWED_LINEAGE','/etc/letsencrypt/live/matrix-ip'))
if lineage.name!='matrix-ip':raise SystemExit(0)
destination=Path(os.environ.get('MATRIX_TLS_DIR','/etc/corenyan-web'))
context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(str(lineage/'fullchain.pem'),str(lineage/'privkey.pem'))
destination.mkdir(parents=True,exist_ok=True)
# Preserve inodes: the running HTTPS container has individual read-only file binds.
for source,name,mode in [('privkey.pem','server.key',0o600),('fullchain.pem','server.crt',0o644)]:
 target=destination/name
 if target.exists():target.chmod(mode)
 with target.open('wb') as output, (lineage/source).open('rb') as data:
  os.fchmod(output.fileno(),mode);shutil.copyfileobj(data,output);output.flush();os.fsync(output.fileno())
print('Matrix TLS certificate deployed; HTTPS listener reloads it automatically.')
