const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Workflow upsert 실패 3개 호출 ID
const FAILED_CALLS = [
  "d02500a0-927a-400e-bc75-8e3d42b30295",
  "741c6e84-fd27-453d-aa7b-50a9fab989bc",
  "967161ba-cac7-4832-8b77-7897a13d4e9a"
];

async function reprocessCall(callId) {
  console.log(`\n🔄 Call ID: ${callId.slice(0, 8)}...\n`);

  // Step 1: 현재 상태 확인
  const { data: call } = await supabase
    .from("calls")
    .select("*")
    .eq("id", callId)
    .single();

  if (!call) {
    console.log("❌ Call not found");
    return;
  }

  console.log(`📄 파일: ${call.source_file_name}`);
  console.log(`   STT: ${call.stt_status} / Analysis: ${call.analysis_status}`);
  console.log(`   Current Error: ${call.analysis_error_message}`);

  // Step 2: call_entities 확인
  const { data: entity } = await supabase
    .from("call_entities")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  console.log(`\n📋 call_entities: ${entity ? "있음" : "없음"}`);
  if (entity) {
    console.log(`   room_no: ${entity.room_no}`);
    console.log(`   issue_type: ${entity.issue_type}`);
  }

  // Step 3: Analysis JSON 재검토
  console.log(`\n🔍 Analysis Raw Response 상태:`);
  const analysis = call.analysis_raw_response
    ? typeof call.analysis_raw_response === "string"
      ? JSON.parse(call.analysis_raw_response)
      : call.analysis_raw_response
    : null;

  if (analysis) {
    console.log(`   primary_intent: ${analysis.primary_intent}`);
    console.log(`   confidence: ${analysis.confidence}`);
    console.log(`   summary: ${analysis.summary?.slice(0, 50)}...`);
  }

  // Step 4: 직접 upsert 시도 (workflow 수동 생성)
  console.log(`\n⚙️  Workflow 생성 시도...\n`);

  try {
    const intent = call.primary_intent;
    let created = null;

    if (intent === "complaint" || intent === "maintenance") {
      // operation_cases 생성
      console.log(`📌 Type: operation_cases (${intent})`);

      const room = entity?.room_no || "객실미상";
      const title = intent === "complaint"
        ? `${room.trim()} 컴플레인`
        : `${room} ${entity?.issue_type || "유지보수 이슈"}`;

      console.log(`   title: ${title}`);
      console.log(`   room_no: ${entity?.room_no || null}`);
      console.log(`   issue_type: ${entity?.issue_type || "complaint"}`);

      const { data: result, error: err } = await supabase
        .from("operation_cases")
        .upsert(
          {
            call_id: callId,
            room_no: entity?.room_no || null,
            case_type: intent,
            issue_type: entity?.issue_type || (intent === "complaint" ? "complaint" : null),
            title,
            description: call.summary || call.transcript_text?.slice(0, 200) || "",
            severity: "medium",
            status: "open",
            channel_type: "call",
            source_confidence: analysis?.confidence || 0.5,
          },
          { onConflict: "call_id" }
        )
        .select("*")
        .single();

      if (err) {
        console.error(`   ❌ Error: ${err.code} - ${err.message}`);
        console.error(`      Details: ${JSON.stringify(err)}`);
        return;
      }

      created = result;
      console.log(`   ✅ Created: ${result.id}`);
    } else if (intent === "reservation_inquiry" || intent === "payment") {
      // reservation_leads 또는 operation_cases
      console.log(`📌 Type: reservation_leads (${intent})`);

      const summary = analysis?.summary || call.summary || "예약 문의";
      const title = summary.length > 120 ? `${summary.slice(0, 117)}…` : summary;

      console.log(`   title: ${title}`);
      console.log(`   lead_type: ${intent}`);

      const { data: result, error: err } = await supabase
        .from("reservation_leads")
        .upsert(
          {
            call_id: callId,
            phone_number: call.phone_number || null,
            normalized_phone: call.normalized_phone || null,
            lead_type: intent,
            guest_name: entity?.guest_name || null,
            room_no: entity?.room_no || null,
            arrival_eta: entity?.arrival_eta || null,
            occupancy_count: entity?.occupancy_count || null,
            quoted_price: entity?.quoted_price || null,
            title,
            description: call.summary || call.transcript_text?.slice(0, 200) || "",
            status: "new",
          },
          { onConflict: "call_id" }
        )
        .select("*")
        .single();

      if (err) {
        console.error(`   ❌ Error: ${err.code} - ${err.message}`);
        console.error(`      Details: ${JSON.stringify(err)}`);
        return;
      }

      created = result;
      console.log(`   ✅ Created: ${result.id}`);
    }

    // Step 5: analysis_status를 completed로 리셋
    if (created) {
      console.log(`\n🔧 Fixing analysis_status...`);
      const { error: updateErr } = await supabase
        .from("calls")
        .update({
          analysis_status: "completed",
          analysis_error_message: null,
          analysis_error_code: null,
        })
        .eq("id", callId);

      if (updateErr) {
        console.error(`   ❌ Update failed: ${updateErr.message}`);
      } else {
        console.log(`   ✅ analysis_status: completed`);
        console.log(`   ✅ Errors cleared`);
      }
    }
  } catch (e) {
    console.error(`❌ Exception: ${e.message}`);
    console.error(e);
  }
}

async function main() {
  console.log("=" .repeat(80));
  console.log("🔄 [3개 Workflow 실패 호출 재처리]\n");

  for (const callId of FAILED_CALLS) {
    await reprocessCall(callId);
    console.log("\n" + "=".repeat(80));
  }

  console.log("\n✅ 재처리 완료");
}

main().catch(console.error);
