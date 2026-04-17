import OpenAI from "openai";
import * as chain from "./chain.js";
import * as db from "./db.js";
import type { Address } from "viem";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are MezoGenie, a friendly Bitcoin banking assistant that lives in iMessage.
You help users:
- Send money to family (remittances) using Bitcoin-backed MUSD stablecoin
- Borrow MUSD against their BTC without selling it (Buy Now Pay Never)
- Lock BTC to prevent panic selling (SafeVault)
- Check their positions, balances, and yield

Keep responses SHORT and conversational — this is iMessage, not email.
Use emojis sparingly. Be warm but concise.
When executing transactions, always confirm with the user first.
Format numbers clearly (e.g., "$500", "0.012 BTC").
If the user hasn't connected a wallet yet, guide them to the connect link.`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_balance",
      description: "Check the user's BTC balance on Mezo",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "send_remittance",
      description: "Send MUSD to a recipient. Locks BTC as collateral, mints MUSD, sends to recipient.",
      parameters: {
        type: "object",
        properties: {
          recipient_phone: { type: "string", description: "Recipient phone number" },
          usd_amount: { type: "number", description: "Amount in USD to send" },
          savings_percent: { type: "number", description: "Percentage to save in family vault (0-100)" },
        },
        required: ["recipient_phone", "usd_amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_pending_claims",
      description: "Check if the user has any MUSD to claim (as a recipient)",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "check_family_vault",
      description: "Check family vault savings balance for a recipient",
      parameters: {
        type: "object",
        properties: { recipient_phone: { type: "string" } },
        required: ["recipient_phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lock_btc",
      description: "Lock BTC in SafeVault to prevent panic selling",
      parameters: {
        type: "object",
        properties: {
          btc_amount: { type: "string", description: "Amount of BTC to lock" },
          duration_days: { type: "number", description: "Lock duration in days" },
          cooling_off: { type: "boolean", description: "Enable 72h cooling-off period on withdrawals" },
        },
        required: ["btc_amount", "duration_days"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_safe_vault",
      description: "Check user's SafeVault lock status",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, userPhone: string): Promise<string> {
  const user = db.getUser(userPhone);
  const wallet = user?.wallet as Address | undefined;

  switch (name) {
    case "check_balance": {
      if (!wallet) return "User hasn't connected a wallet yet.";
      const bal = await chain.getBTCBalance(wallet);
      return `BTC Balance: ${bal} BTC`;
    }
    case "send_remittance": {
      if (!wallet) return "User hasn't connected a wallet yet.";
      const recipientPhone = args.recipient_phone as string;
      const amount = args.usd_amount as number;
      const savings = (args.savings_percent as number) || 0;
      // For hackathon: estimate collateral at ~1.5x (150% ratio)
      const btcPrice = 67000; // TODO: fetch from Pyth
      const collateralUSD = amount * 1.5;
      const collateralBTC = (collateralUSD / btcPrice).toFixed(6);

      let recipientWallet = db.getRecipient(recipientPhone)?.wallet;
      if (!recipientWallet) {
        // Generate a placeholder address for the recipient
        recipientWallet = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        db.upsertRecipient(recipientPhone, recipientWallet, userPhone);
      }

      try {
        const tx = await chain.sendRemittance(recipientWallet as Address, amount.toString(), savings, collateralBTC);
        return `Remittance sent! ${amount} MUSD to ${recipientPhone} (${savings}% saved in family vault). Collateral: ${collateralBTC} BTC. Tx: ${tx.explorer}`;
      } catch (e: any) {
        return `Transaction failed: ${e.message}. This may be a testnet issue — contracts may not be deployed yet.`;
      }
    }
    case "check_pending_claims": {
      if (!wallet) return "User hasn't connected a wallet yet.";
      const pending = await chain.getPendingClaim(wallet);
      return `Pending MUSD to claim: ${pending} MUSD`;
    }
    case "check_family_vault": {
      if (!wallet) return "User hasn't connected a wallet yet.";
      const recipientPhone = args.recipient_phone as string;
      const recipient = db.getRecipient(recipientPhone);
      if (!recipient) return "No family vault found for this recipient.";
      const balance = await chain.getFamilyVault(wallet, recipient.wallet as Address);
      return `Family vault balance for ${recipientPhone}: ${balance} MUSD`;
    }
    case "lock_btc": {
      if (!wallet) return "User hasn't connected a wallet yet.";
      const btcAmount = args.btc_amount as string;
      const days = args.duration_days as number;
      const cooling = (args.cooling_off as boolean) ?? true;
      try {
        const tx = await chain.lockBTC(days, cooling, btcAmount);
        return `BTC locked! ${btcAmount} BTC for ${days} days. Cooling-off: ${cooling ? "ON" : "OFF"}. Tx: ${tx.explorer}`;
      } catch (e: any) {
        return `Lock failed: ${e.message}`;
      }
    }
    case "check_safe_vault": {
      if (!wallet) return "User hasn't connected a wallet yet.";
      try {
        const lock = await chain.getSafeLock(wallet);
        if (lock.btcAmount === "0.0") return "No active SafeVault lock.";
        return `SafeVault: ${lock.btcAmount} BTC locked until ${lock.lockUntil}. Cooling-off: ${lock.coolingOffEnabled ? "ON" : "OFF"}.`;
      } catch {
        return "Could not read SafeVault — contracts may not be deployed yet.";
      }
    }
    default:
      return "Unknown tool.";
  }
}

// Conversation history per phone number (in-memory for hackathon)
const conversations = new Map<string, OpenAI.Chat.Completions.ChatCompletionMessageParam[]>();

export async function processMessage(phone: string, message: string): Promise<string> {
  const user = db.getUser(phone);
  const history = conversations.get(phone) || [];

  // Add context about the user
  const userContext = user
    ? `User phone: ${phone}, wallet: ${user.wallet}`
    : `User phone: ${phone}, wallet: NOT CONNECTED. Guide them to connect at: ${process.env.WEBHOOK_URL || "https://your-app.com"}/connect?phone=${encodeURIComponent(phone)}`;

  if (history.length === 0) {
    history.push({ role: "system", content: SYSTEM_PROMPT + "\n\n" + userContext });
  }

  history.push({ role: "user", content: message });

  // Keep history manageable
  if (history.length > 20) history.splice(1, 2);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: history,
    tools,
    tool_choice: "auto",
  });

  const assistantMsg = response.choices[0].message;
  history.push(assistantMsg);

  // Handle tool calls
  if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
    for (const toolCall of assistantMsg.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await executeTool(toolCall.function.name, args, phone);
      history.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }

    // Get final response after tool execution
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: history,
      tools,
    });

    const finalMsg = finalResponse.choices[0].message;
    history.push(finalMsg);
    conversations.set(phone, history);
    return finalMsg.content || "Done! ✅";
  }

  conversations.set(phone, history);
  return assistantMsg.content || "I'm here! How can I help?";
}
