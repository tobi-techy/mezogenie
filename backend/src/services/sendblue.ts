const BASE = "https://api.sendblue.com";

const headers = () => ({
  "Content-Type": "application/json",
  "sb-api-key-id": process.env.SENDBLUE_API_KEY!,
  "sb-api-secret-key": process.env.SENDBLUE_API_SECRET!,
});

export async function sendMessage(phone: string, content: string) {
  const res = await fetch(`${BASE}/api/send-message`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ number: phone, content }),
  });
  return res.json();
}

export async function sendTypingIndicator(phone: string) {
  await fetch(`${BASE}/api/send-typing-indicator`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ number: phone }),
  }).catch(() => {}); // best-effort
}

export async function sendReaction(phone: string, messageId: string, reaction: string) {
  await fetch(`${BASE}/api/send-reaction`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ number: phone, message_id: messageId, reaction }),
  }).catch(() => {});
}

export interface IncomingMessage {
  number: string;
  content: string;
  media_url?: string;
  message_id?: string;
  date_sent?: string;
}
