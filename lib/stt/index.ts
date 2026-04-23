import { MockSttProvider } from "@/lib/stt/mock";
import { OpenAISttProvider } from "@/lib/stt/openai";
import type { SttProvider } from "@/lib/stt/provider";

export function getSttProvider(): SttProvider {
  const provider = (process.env.STT_PROVIDER ?? "openai").toLowerCase();
  if (provider === "mock") {
    return new MockSttProvider();
  }
  if (provider === "openai") {
    return new OpenAISttProvider();
  }
  console.warn(
    `[stt] Unknown STT_PROVIDER="${provider}", falling back to openai`,
  );
  return new OpenAISttProvider();
}
