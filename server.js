const Hapi = require("@hapi/hapi");
const admin = require("firebase-admin");
require("dotenv").config();

// Initialize Firestore
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});
const db = admin.firestore();

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: "0.0.0.0",
  });

  // Register Routes
  await server.register(require("./routes"));

  await server.start();
  console.log(`Server running on ${server.info.uri}`);
};

process.on("unhandledRejection", (err) => {
  console.error(err);
  process.exit(1);
});

init();
