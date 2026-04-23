const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

debugWorkflowFailure().catch(console.error);

async function debugWorkflowFailure() {
  // Workflow upsert 실패 호출 3건
  const WORKFLOW_FAILURES = [
    "d02500a0-927a-400e-bc75-8e3d42b30295",
    "741c6e84-fd27-453d-aa7b-50a9fab989bc",
    "967161ba-cac7-4832-8b77-7897a13d4e9a"
  ];

  console.log("🔥 [Workflow Upsert 실패 호출 3건 완전 해부 시작]\n");
  console.log("=" .repeat(80));

  for (let i = 0; i < WORKFLOW_FAILURES.length; i++) {
    const callId = WORKFLOW_FAILURES[i];

    console.log(`\n\n📍 [${i + 1}번 호출 상세 분석]\n`);

    const { data: call } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .single();

    if (!call) {
      console.log(`❌ Call not found: ${callId}`);
      continue;
    }

    console.log(`📄 기본 정보:`);
    console.log(`  파일: ${call.source_file_name}`);
    console.log(`  Call ID: ${call.id}`);
    console.log(`  Analysis Error: ${call.analysis_error_message}`);
    console.log(`  Error Code: ${call.analysis_error_code}`);

    console.log(`\n📋 STT & Analysis 상태:`);
    console.log(`  STT Status: ${call.stt_status}`);
    console.log(`  STT Confidence: ${call.stt_confidence}`);
    console.log(`  STT Provider: ${call.stt_provider}`);
    console.log(`  STT Error: ${call.stt_error_message || "없음"}`);
    console.log(`  Analysis Status: ${call.analysis_status}`);
    console.log(`  Analysis Confidence: ${call.analysis_confidence}`);
    console.log(`  Analysis Version: ${call.analysis_version}`);
    console.log(`  Analysis Persist: ${call.analysis_persist_level}`);

    console.log(`\n📝 전사 & 분석 결과:`);
    if (call.transcript_text) {
      const preview = call.transcript_text.slice(0, 80);
      console.log(`  Transcript: ${preview}...`);
      console.log(`  길이: ${call.transcript_text.length}자`);
    } else {
      console.log(`  Transcript: ❌ NULL`);
    }

    console.log(`  Summary: ${call.summary ? "✅ 있음" : "❌ NULL"}`);
    console.log(`  Primary Intent: ${call.primary_intent || "❌ NULL"}`);

    console.log(`\n🔍 Analysis Raw Response 검토:`);
    if (call.analysis_raw_response) {
      try {
        const analysis = typeof call.analysis_raw_response === "string"
          ? JSON.parse(call.analysis_raw_response)
          : call.analysis_raw_response;

        console.log(`  ✅ JSON 파싱 성공`);
        console.log(`  필드들:`);
        console.log(`    - primary_intent: ${analysis.primary_intent || "❌ MISSING"}`);
        console.log(`    - sentiment: ${analysis.sentiment || "❌ MISSING"}`);
        console.log(`    - confidence: ${analysis.confidence !== undefined ? analysis.confidence : "❌ MISSING"}`);
        console.log(`    - category: ${analysis.category || "❌ MISSING"}`);
        console.log(`    - entities: ${Array.isArray(analysis.entities) ? analysis.entities.length + "개" : "❌ MISSING"}`);

        console.log(`\n  Full JSON:`);
        console.log(JSON.stringify(analysis, null, 2));
      } catch (e) {
        console.log(`  ❌ JSON 파싱 실패: ${e.message}`);
        console.log(`  Raw: ${call.analysis_raw_response.slice(0, 150)}`);
      }
    } else {
      console.log(`  ❌ NULL - 분석 결과 없음!`);
    }

    console.log(`\n🔗 Workflow 생성 시도 기록:`);
    const { data: workflows } = await supabase
      .from("workflows")
      .select("*")
      .eq("call_id", callId);

    if (workflows && workflows.length > 0) {
      console.log(`  총 시도: ${workflows.length}건`);
      workflows.forEach((wf, idx) => {
        console.log(`\n  [시도 ${idx + 1}]`);
        console.log(`    Workflow ID: ${wf.id}`);
        console.log(`    Type: ${wf.workflow_type}`);
        console.log(`    Status: ${wf.status}`);
        if (wf.error) {
          console.log(`    ❌ Error: ${wf.error}`);
        }
        console.log(`    Created: ${wf.created_at}`);
      });
    } else {
      console.log(`  ⚠️  워크플로우 레코드 없음 (생성 실패)`);
    }

    console.log(`\n🎯 createWorkflowFromCall 함수 호출 검증:`);
    console.log(`  입력값:`);
    console.log(`  {`);
    console.log(`    callId: "${call.id}",`);
    console.log(`    transcription: "${call.transcript_text ? call.transcript_text.slice(0, 40) : "NULL"}...",`);
    console.log(`    analysis_raw_response: ${call.analysis_raw_response ? "있음" : "NULL"}`);
    console.log(`  }`);

    console.log(`\n📊 실패 원인 분석:`);
    const issues = [];

    if (!call.transcript_text) issues.push("❌ transcript_text가 NULL");
    if (!call.analysis_raw_response) issues.push("❌ analysis_raw_response가 NULL");
    if (!call.primary_intent) issues.push("❌ primary_intent가 NULL (분석 미완료)");
    if (call.analysis_status === "failed") issues.push("❌ analysis_status 자체가 failed");

    if (issues.length === 0) {
      issues.push("✅ 필수 필드는 모두 있음 → DB 제약 조건 문제일 수 있음");
    }

    issues.forEach((issue) => console.log(`  ${issue}`));

    console.log("\n" + "=".repeat(80));
  }
}
