# Ad Client Migration Guide

This folder contains the core functionality for the SoftoMedia Ad Player, which serves ad images every 5 seconds.

## Contents

- `client/`: Frontend React components and configuration.
  - `Player.jsx`: The main player UI and playback logic.
  - `config.js`: Centralized API configuration.
- `server/`: Backend Node.js API implementation.
  - `index.js`: Main server entry point with core routes.
  - `src/api/`: API route handlers (playlist, screens, schedules).
  - `src/utils/`: Utility functions (signed URLs, logging).
  - `src/middleware/`: Express middleware.
- `assets/`: Demo ad images.

## Migration Steps

1. **Frontend**:
   - Copy `client/Player.jsx` to your new React project's pages/components folder.
   - Ensure you have `react-router-dom` installed.
   - Update `client/config.js` with your backend URL.

2. **Backend**:
   - Copy the `server/` directory.
   - Run `npm install` in the server project.
   - Ensure you have a Google Cloud Project with Firestore and GCS enabled.
   - Set the `PROJECT_ID` environment variable.
   - The server depends on `@google-cloud/firestore`, `@google-cloud/storage`, `express`, `cors`, `jsonwebtoken`, and `bcryptjs`.

3. **Storage**:
   - Upload the images from `assets/` to your GCS bucket (update the bucket name in `src/utils/storage.js`).

4. **Database**:
   - Seed your Firestore database with campaigns and screenings as seen in the database logic in `server/index.js` (debug seed section).
