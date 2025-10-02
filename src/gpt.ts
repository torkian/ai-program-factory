import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function chat(prompt: string, input?: any, model = process.env.MODEL || "gpt-4o-mini") {
  const sys = prompt;
  const user = input ? JSON.stringify(input) : "";
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(res.choices[0].message.content || "{}");
}

export async function prose(prompt: string, input?: any, model = process.env.MODEL || "gpt-4o-mini") {
  const sys = prompt;
  const user = input ? JSON.stringify(input) : "";
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: sys }, { role: "user", content: user }]
  });
  return res.choices[0].message.content || "";
}