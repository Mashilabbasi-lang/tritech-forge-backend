// Local development entry point
import "dotenv/config";
import { initDb } from "./db.js";
import app from "./app.js";

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ TriTech Forge API running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
  });
});
