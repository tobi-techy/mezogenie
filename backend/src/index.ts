import "dotenv/config";
import express from "express";
import { sendMessage, sendTypingIndicator, type IncomingMessage } from "./services/sendblue.js";
import { processMessage } from "./services/agent.js";
import { getUser, upsertUser } from "./services/db.js";

const app = express();
app.use(express.json());

// --- Health check ---
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "MezoGenie", version: "1.0.0" });
});

// --- Sendblue webhook: incoming iMessage ---
app.post("/webhook/sendblue", async (req, res) => {
  const msg: IncomingMessage = req.body;
  const phone = msg.number;
  const content = msg.content;

  if (!phone || !content) return res.status(400).json({ error: "Missing phone or content" });

  console.log(`📩 ${phone}: ${content}`);

  // Acknowledge immediately
  res.status(200).json({ status: "received" });

  try {
    // Show typing indicator while AI thinks
    await sendTypingIndicator(phone);

    // Process through AI agent
    const reply = await processMessage(phone, content);

    // Send response via iMessage
    await sendMessage(phone, reply);
    console.log(`📤 → ${phone}: ${reply.substring(0, 80)}...`);
  } catch (err) {
    console.error("Error processing message:", err);
    await sendMessage(phone, "Sorry, something went wrong. Try again in a moment! 🔧");
  }
});

// --- Wallet connect callback (from the web page) ---
app.post("/api/connect-wallet", (req, res) => {
  const { phone, wallet } = req.body;
  if (!phone || !wallet) return res.status(400).json({ error: "Missing phone or wallet" });

  upsertUser(phone, wallet);
  console.log(`🔗 Wallet connected: ${phone} → ${wallet}`);

  // Notify user via iMessage
  sendMessage(phone, `✅ Wallet connected! Your Bitcoin bank is ready.\n\nTry:\n• "What's my balance?"\n• "Send $500 to +1234567890"\n• "Lock my BTC for 6 months"`);

  res.json({ status: "connected" });
});

// --- Get user info (for the web page) ---
app.get("/api/user/:phone", (req, res) => {
  const user = getUser(req.params.phone);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🧞 MezoGenie backend running on port ${PORT}`);
  console.log(`   Webhook URL: POST /webhook/sendblue`);
  console.log(`   Wallet connect: POST /api/connect-wallet`);
  console.log(`   Health: GET /\n`);
});
