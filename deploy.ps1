param(
    [string]$ProjectId = "softomedia-live2026",
    [string]$Region = "us-central1",
    [string]$BackendService = "ad-server",
    [string]$JwtSecret = ""
)

Write-Host "SoftoMedia Deployment Script" -ForegroundColor Cyan
Write-Host "=============================="

# Step 1: Check Prerequisites
Write-Host "Step 1: Checking Prerequisites..." -ForegroundColor Yellow

# Check gcloud
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "gcloud CLI found: $gcloudVersion" -ForegroundColor Green
}
catch {
    Write-Host "gcloud CLI not found. Please install: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
}

# Check firebase
try {
    $firebaseVersion = firebase --version 2>&1
    Write-Host "Firebase CLI found: $firebaseVersion" -ForegroundColor Green
}
catch {
    Write-Host "Firebase CLI not found. Install with: npm install -g firebase-tools" -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "Node.js not found. Please install: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Step 2: Generate JWT Secret if not provided
Write-Host "Step 2: JWT Secret Configuration..." -ForegroundColor Yellow

if ($JwtSecret -eq "") {
    Write-Host "Generating new JWT secret..." -ForegroundColor Gray
    $JwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    Write-Host "JWT Secret generated: $JwtSecret" -ForegroundColor Green
}
else {
    Write-Host "Using provided JWT secret" -ForegroundColor Green
}

# Step 3: Set GCloud Project
Write-Host "Step 3: Configuring Google Cloud Project..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# Step 4: Deploy Backend to Cloud Run
Write-Host "Step 4: Building and Deploying Backend..." -ForegroundColor Yellow
Write-Host "This may take 5-10 minutes..." -ForegroundColor Gray

Set-Location "ad-server"

# Submit build
Write-Host "Building container..." -ForegroundColor Gray
gcloud builds submit --config cloudbuild.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "Backend build successful!" -ForegroundColor Green

# Set environment variables (Redundant as cloudbuild.yaml handles this, but keeping for reference without JWT_SECRET conflict)
Write-Host "Configuring environment variables..." -ForegroundColor Gray
gcloud run services update $BackendService `
    --set-env-vars="PROJECT_ID=$ProjectId,GCS_BUCKET=$ProjectId.appspot.com" `
    --region=$Region


if ($LASTEXITCODE -ne 0) {
    Write-Host "Environment variable configuration failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# Get backend URL
$BackendUrl = gcloud run services describe $BackendService --region=$Region --format="value(status.url)"
Write-Host "Backend deployed at: $BackendUrl" -ForegroundColor Green

Set-Location ..

# Step 5: Deploy Frontend to Firebase
Write-Host "Step 5: Building and Deploying Frontend..." -ForegroundColor Yellow

Set-Location "client-app"

# Create/update .env.production
Write-Host "Configuring frontend environment..." -ForegroundColor Gray
"VITE_API_URL=$BackendUrl" | Out-File -FilePath ".env.production" -Encoding UTF8 -Force

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Gray
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# Build production bundle
Write-Host "Building production bundle..." -ForegroundColor Gray
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "Frontend build successful!" -ForegroundColor Green

# Deploy to Firebase
Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Gray
firebase deploy --only hosting

if ($LASTEXITCODE -ne 0) {
    Write-Host "Firebase deployment failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

# Step 6: Post-Deployment Verification
Write-Host "Deployment Complete!" -ForegroundColor Green

Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "  Backend:  $BackendUrl"
Write-Host "  Project:  $ProjectId"
Write-Host "  Region:   $Region"

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Test backend health: $BackendUrl/health"
Write-Host "  2. Open frontend and test login"
Write-Host "  3. Login credentials (sokallel@gmail.com / thisisbusiness)"

Write-Host "Important:" -ForegroundColor Yellow
Write-Host "  - JWT Secret: $JwtSecret"
Write-Host "  - Save this secret for future use!"

Write-Host "Monitor Logs:" -ForegroundColor Cyan
Write-Host "  gcloud run logs read --service=$BackendService --region=$Region" -ForegroundColor Gray
