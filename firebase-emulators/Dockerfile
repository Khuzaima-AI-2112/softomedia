# Firebase Auth, Firestore and Storage emulators for the local Docker demo.
# Not a Cloud Run service — no production equivalent.

# Firestore's emulator ships as a Java jar and needs Java 21+, newer than what
# Debian bookworm packages. Borrow the JRE from the official multi-arch
# eclipse-temurin image instead of fighting apt repos.
FROM eclipse-temurin:21-jre-jammy AS java

FROM node:20-bookworm-slim

ENV CI=true
COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"

RUN npm install -g firebase-tools@^15.22.0

WORKDIR /app

# Bake the Firestore emulator jar into the image so container startup
# never needs to download anything.
RUN firebase setup:emulators:firestore

COPY firebase.json ./firebase.json
COPY firestore.indexes.json ./firestore.indexes.json
COPY ad-server/firestore.rules ./ad-server/firestore.rules
COPY ad-server/storage.rules ./ad-server/storage.rules
COPY firebase-emulators/healthcheck.js ./healthcheck.js

EXPOSE 9099 8090 9199

HEALTHCHECK --interval=5s --timeout=3s --start-period=40s --retries=20 \
    CMD node ./healthcheck.js

CMD ["firebase", "emulators:start", "--project", "softomedia-demo", "--only", "auth,firestore,storage"]
