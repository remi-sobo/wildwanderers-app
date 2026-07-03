import "server-only";

// Voice is off until a Deepgram key is set; the mic then appears on the
// client's check-in card.
export function voiceConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

// Transcribe a recorded check-in with Deepgram's prerecorded API. Server-only
// so the key never reaches the browser.
export async function transcribeAudio(bytes: ArrayBuffer, mimeType: string): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("voice-not-configured");

  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": mimeType || "audio/webm",
      },
      body: Buffer.from(bytes),
    },
  );
  if (!res.ok) throw new Error("transcribe-failed");
  const json = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  return json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
}
