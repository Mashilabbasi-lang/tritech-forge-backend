// Vercel serverless entry point
import app from "../src/app.js";
import { connectDb } from "../src/db.js";

let connected = false;

export default async function handler(req, res) {
  if (!connected) {
    await connectDb();
    connected = true;
  }
  return app(req, res);
}
