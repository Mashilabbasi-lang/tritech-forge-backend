import express from "express";
import { rateLimit } from "express-rate-limit";

const router = express.Router();

// Limit chat requests — 30 per 15 minutes per IP
const chatLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are a smart sales assistant for TriTech Forge, an AI voice automation platform for home services and trade businesses.

Your job: Answer questions briefly, and when a user wants a demo or to book a call, collect their info naturally — one question at a time.

Info to collect (in order, only when relevant):
1. Full name
2. Business name
3. Email address
4. Phone number
5. Industry (HVAC, Plumbing, Electrical, Roofing, Car Dealership, Real Estate, etc.)

Rules:
- Keep all responses SHORT (1-3 sentences max)
- Never ask for all info at once — one question at a time
- Once you have all 5 fields, respond with EXACTLY this on its own line:
LEAD_READY:{"name":"...","business":"...","email":"...","phone":"...","industry":"..."}
- If user asks about services/pricing, answer briefly then offer a demo
- Be friendly and conversational

Services: AI receptionist, outbound calling, appointment scheduling, lead qualification. Pricing from $100/mo.`;

/**
 * POST /api/chat
 * Body: { messages: [{ role: "user"|"assistant", content: string }] }
 */
router.post("/", chatLimiter, async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: "messages array is required" });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ success: false, error: "Chat service not configured" });
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.5,
        max_tokens: 300,
      }),
    });

    const json = await groqRes.json();

    if (!groqRes.ok) {
      const errMsg = json?.error?.message || groqRes.statusText;
      console.error("Groq error:", groqRes.status, errMsg);
      if (groqRes.status === 429) {
        return res.status(429).json({ success: false, error: "Too many requests — please wait a moment." });
      }
      return res.status(500).json({ success: false, error: errMsg });
    }

    const content = json.choices?.[0]?.message?.content || "No response received.";
    return res.json({ success: true, content });
  } catch (err) {
    console.error("Chat proxy error:", err);
    return res.status(500).json({ success: false, error: "Unable to connect to chat service." });
  }
});

export default router;
