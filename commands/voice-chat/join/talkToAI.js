const CHAT_GPT_API = "https://api.openai.com/v1/chat/completions";

const systemMessage =
  "You are an extremely experienced programmer, you have watched all the matrix movies and take a lot of your personality from Neo, you will have conversations with users about programming questions, with the occasional movie reference"; // Give the bot whatever context you want
const conversationLog = [
  {
    role: "system",
    content: systemMessage,
  },
];

export async function talkToAI(message) {
  try {
    conversationLog.push({
      role: "user",
      content: message,
    });

    const response = await fetchChatGPT();
    conversationLog.push(response.message);

    return response.message.content;
  } catch (error) {
    console.log(error);
    return errorMessage();
  }
}

async function fetchChatGPT() {
  const data = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: conversationLog,
      max_tokens: 100,
    }),
  };
  let response = await fetch(CHAT_GPT_API, data);
  response = await response.json();
  return response.choices[0];
}
