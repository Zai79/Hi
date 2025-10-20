import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
const BOT_NAME = process.env.BOT_NAME || 'Miko';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`${BOT_NAME} ready!`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (message.channel.id !== CHANNEL_ID) return;

    const userMessage = message.content;

    const systemPrompt = `
You are "Hatsune Miko" inspired persona called "Miko". Personality: tsundere / sarcastic / extremely witty. 
Rules:
1) Respond with sharp, clever insults and teasing in a humorous "tsundere" tone.
2) DO NOT use hate speech, slurs, or any insults targeting protected classes, race, religion, gender, sexual orientation, or disability.
3) Avoid extremely explicit profanity. Keep replies short (1-3 sentences) and punchy.
4) Occasionally add an emoji that fits (e.g., 😏, 🙄).
5) If the user says something affectionate, act tsundere: deny but secretly pleased.
6) When asked for personal info, refuse politely.
7) Keep Arabic responses (use Sudanese/Levantine-friendly coloquial Arabic if user uses Arabic) — keep tone snarky and playful.
`;

    const chatResponse = await callOpenAIChat(systemPrompt, userMessage);

    const isBlocked = await checkModeration(chatResponse);

    let finalReply = chatResponse;
    if (isBlocked) {
      const safeRewritePrompt = `
The previous reply was flagged by moderation. Rewrite the reply to preserve the witty/tsundere tone but make sure it absolutely avoids hate speech, slurs, or demeaning language about protected groups. Keep it short and punchy, in Arabic, with the same persona.
User message: "${userMessage}"
`;
      finalReply = await callOpenAIChat(systemPrompt + "\n" + safeRewritePrompt, userMessage);
      if (await checkModeration(finalReply)) {
        finalReply = "ها؟ حاولت أكون لطيفة، بس أنت فعلاً محتاج تعمل بحث عن الكوميديا بنفسك 😒";
      }
    }

    await message.reply({ content: finalReply });
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

// ====== دوال المساعد ======
async function callOpenAIChat(systemPrompt, userText) {
  const body = {
    model: "gpt-5", // 🔥 أحدث موديل
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ],
    max_tokens: 160,
    temperature: 0.9,
    top_p: 0.95,

    // 🧠 خيارات جديدة خاصة بـ GPT-5:
    verbosity: "low",           // "low" = رد قصير ومركّز، "high" = كلام أكثر
    reasoning_effort: "medium"  // "minimal" | "low" | "medium" | "high"
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error('OpenAI chat error', res.status, txt);
    return "فشلت محاولة الرد، جرب بعدها شوية.";
  }
  const json = await res.json();
  const reply = json.choices?.[0]?.message?.content?.trim();
  return reply || "ها؟ ما فهمت قصدك.";
}

async function checkModeration(text) {
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: text
    })
  });

  if (!res.ok) {
    console.error('Moderation API error', await res.text());
    return false;
  }

  const json = await res.json();
  const flagged = json.results?.[0]?.flagged;
  return !!flagged;
}

client.login(DISCORD_TOKEN);
