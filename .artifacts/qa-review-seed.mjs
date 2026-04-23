import fs from "node:fs";
import path from "node:path";

function readEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

const env = readEnv();
const uploadsDir = "C:/dev/stay-ops-call/uploads/calls";
const sampleName = "qa-raw-sample-20260323.m4a";
const samplePath = path.join(uploadsDir, sampleName);

if (!fs.existsSync(samplePath)) {
  const source = fs
    .readdirSync(uploadsDir)
    .filter((f) => f.toLowerCase().endsWith(".m4a"))[0];
  if (!source) throw new Error("No source fixture file found in uploads/calls");
  fs.copyFileSync(path.join(uploadsDir, source), samplePath);
}

const key = env.SUPABASE_SERVICE_ROLE_KEY;
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/calls`;
const row = {
  batch_job_id: "fa61d21c-67bb-429b-b815-dd9337952097",
  source_file_name: sampleName,
  analysis_status: "failed",
  review_status: "rejected",
  label_status: "auto",
  analysis_error_code: "qa_seed_failed",
  analysis_error_message: "qa seeded failed row",
  note: "qa-seed-failed-source-file",
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(row),
});

if (!res.ok) throw new Error(await res.text());
const data = await res.json();
console.log(JSON.stringify({ samplePath, seededCallId: data?.[0]?.id ?? null }, null, 2));
