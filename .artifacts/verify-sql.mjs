import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const bid = "36e9b505-82cc-4330-96f1-ed8b4f994673";
const env = readFileSync('.env.local', 'utf8');
const url = (env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m) || [])[1]?.trim();
const key = (env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m) || [])[1]?.trim();
const sb = createClient(url, key, { auth: { persistSession: false } });

const all = await sb
  .from('calls')
  .select('review_status,label_status,source_file_name,file_fingerprint,batch_job_id,analysis_status,analysis_error_code,analysis_error_message');
const rows = all.data || [];

const g = new Map();
for (const r of rows) {
  const k = `${r.review_status ?? 'null'}|${r.label_status ?? 'null'}`;
  g.set(k, (g.get(k) || 0) + 1);
}
console.log('GROUP');
for (const [k, v] of [...g.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))) {
  console.log(k, v);
}

const dup = new Map();
for (const r of rows) {
  const k = `${r.source_file_name ?? 'null'}|${r.file_fingerprint ?? 'null'}`;
  dup.set(k, (dup.get(k) || 0) + 1);
}
const dupRows = [...dup.entries()]
  .filter(([, c]) => c > 1)
  .map(([k, c]) => ({ key: k, count: c }));
console.log('DUP_COUNT', dupRows.length);
console.log('DUP_SAMPLE', JSON.stringify(dupRows.slice(0, 20), null, 2));

const batchRows = rows.filter((r) => r.batch_job_id === bid);
console.log('BATCH_ROWS', JSON.stringify(batchRows, null, 2));
console.log('BATCH_NULL_BATCHID', batchRows.filter((r) => !r.batch_job_id).length);

const fails = rows
  .filter((r) => r.analysis_status === 'failed')
  .slice(0, 10)
  .map((r) => ({
    analysis_error_code: r.analysis_error_code,
    analysis_error_message: r.analysis_error_message,
    source_file_name: r.source_file_name,
    batch_job_id: r.batch_job_id,
  }));
console.log('FAILED_EXAMPLES', JSON.stringify(fails, null, 2));
