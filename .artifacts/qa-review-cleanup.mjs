import fs from "node:fs";

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
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/calls`;

const delSeeded = await fetch(
  `${base}?note=eq.qa-seed-failed-source-file&source_file_name=eq.qa-raw-sample-20260323.m4a`,
  {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  },
);

if (!delSeeded.ok) throw new Error(await delSeeded.text());

const samplePath = "C:/dev/stay-ops-call/uploads/calls/qa-raw-sample-20260323.m4a";
if (fs.existsSync(samplePath)) {
  fs.unlinkSync(samplePath);
}

console.log(JSON.stringify({ deletedSeedRows: true, deletedSampleFile: !fs.existsSync(samplePath) }, null, 2));
