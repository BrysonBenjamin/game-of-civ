/**
 * AI Chat Route — Vercel AI SDK
 *
 * Stub API route for the Vibe Console. Once an OpenAI (or other)
 * API key is provided via OPENAI_API_KEY env var, this route will
 * convert natural-language player input to structured game commands.
 */

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json() as { message?: string };

  // TODO: Replace with real Vercel AI SDK streaming once API key is configured.
  // Example with Vercel AI SDK:
  //
  // import { openai } from "@ai-sdk/openai";
  // import { streamText } from "ai";
  // import { AI_CONFIG } from "@/lib/ai/config";
  //
  // const result = streamText({
  //   model: openai(AI_CONFIG.model),
  //   system: AI_CONFIG.systemPrompt,
  //   messages: [{ role: "user", content: body.message }],
  //   temperature: AI_CONFIG.temperature,
  // });
  // return result.toDataStreamResponse();

  return NextResponse.json({
    reply: `[AI Stub] Received: "${body.message ?? ""}"`,
    command: null,
  });
}
