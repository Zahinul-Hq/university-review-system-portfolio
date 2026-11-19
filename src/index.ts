import { createApp } from "./app.js";
import { config } from "./config.js";

try {
  process.loadEnvFile("./.env");
} catch {
  // .env is optional in production/cloud environments
}

const app = createApp();
const PORT = config.api.port;

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
