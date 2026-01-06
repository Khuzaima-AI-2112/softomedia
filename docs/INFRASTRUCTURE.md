# Infrastructure Documentation

**Project ID**: `softomedia-live-2026`  
**Region**: `us-central1` (Iowa)  
**Provisioner**: Manual + Cloud Build (Hybrid)

---

## 🏗️ Compute (Serverless)

### Cloud Run Services

| Service | URL | Configuration | Auth |
| :--- | :--- | :--- | :--- |
| **`ad-server`** | `https://ad-server-kiieh7nmwa-uc.a.run.app` | Node 20, 512MB RAM | Public (Invoker) |
| **`client-app`** | `https://client-app-kiieh7nmwa-uc.a.run.app` | Nginx (Static), 256MB | Public (Invoker) |

**Scaling Configuration (Default)**:
- **Min Instances**: 0 (Scale to Zero enabled for cost efficiency)
- **Max Instances**: 100 (Default)
- **Concurrency**: 80 requests per instance
- **Execution Environment**: Gen 2 (assumed default for new deployments)

---

## 🗄️ Data & Storage

### Firestore (Native Mode)
NoSQL Document Database acting as the "Source of Truth".

- **Location**: `us-central1` (collocated with compute)
- **Collections**:
    - `users`: Authentication and Role profiles.
    - `ads`: Creative assets metadata and scheduling rules.
    - `media`: Asset metadata (mime-type, duration, URLs).
    - `screens`: Hardware registry and active playlist state.
    - `impressions`: Analytics events (high write volume).
    - `loops`: Daily broadcast schedules (D-1 generated).
    - `campaigns`: Advertising orders and approval workflows.
    - `playlists`: Generated playout instructions.

### Cloud Storage (GCS)
Object storage for creative assets and backups.

- **Bucket**: `softomedia-live-2026-ads`
- **Purpose**: hosting uploaded ad creatives (images/videos).
- **Access**: Public read (via signed URLs or public folder), Private write.

---

## 🛠️ CI/CD Pipeline

**Platform**: Google Cloud Build  
**Configuration**: `cloudbuild.yaml`  
**Trigger**: Push to `main` branch

### Build Steps
1.  **Verification**: Runs `verify_predeploy.js` and checks Secret Manager availability.
2.  **Build**: Docker multi-stage builds for `client-app` and `ad-server`.
3.  **Push**: Artifacts pushed to Artifact Registry (`softomedia` repo).
4.  **Deploy Backend**: `ad-server` deployed to Cloud Run with `JWT_SECRET` injection.
5.  **Health Check**: Critical gate - polls `/health` for 200 OK before proceeding.
6.  **Deploy Rules**: Updates Firestore Security Rules and Indexes.
7.  **Deploy Frontend**: `client-app` deployed with `VITE_API_URL` injected from the live backend URL (Dynamic Binding).

---

## 🔒 Security & Secrets

### Secret Manager
- **`JWT_SECRET`**: Production signing key for authentication tokens. Injected as an environment variable into `ad-server` at runtime.

### IAM & Permissions
- **Cloud Run Invoker**: `allUsers` (Public Application).
- **Build Service Account**: Has permissions to Deploy to Cloud Run, Read Secrets, and Write to Artifact Registry.
- **Service-to-Service**: `client-app` communicates with `ad-server` via public HTTPS (for now).

---

## 🌐 Networking

- **CDN**: Not explicitly configured (using Cloud Run default edge caching).
- **DNS**: Default `*.run.app` domains.
- **CORS**: `ad-server` configured to allow `client-app` origin (via dynamic env var).

---

## 📦 Artifact Registry

- **Repository**: `softomedia` (Docker)
- **Location**: `us-central1`
- **Images**:
    - `client-app:{BUILD_ID}`
    - `ad-server:{BUILD_ID}`

---

*Last Updated: 2026-01-05*
