import type {
  ActionRecommendationRow,
  CallEntityRow,
  CallRow,
  OperationCaseRow,
  ReservationLeadRow,
  ReviewCandidateRow,
  ReviewJobRow,
  ReviewLabelRow,
  ServiceRequestRow,
} from "@/lib/types/database";

import { CallDetailActions } from "@/components/calls/CallDetailActions";
import { CallDetailWorkbench } from "@/components/calls/CallDetailWorkbench";
import { RecommendationList } from "@/components/calls/RecommendationList";

export type CallDetailReviewLink = {
  job: ReviewJobRow;
  candidate: ReviewCandidateRow;
  label: ReviewLabelRow | null;
};

function analysisStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "text-emerald-700 dark:text-emerald-400";
    case "partial":
    case "warning":
      return "text-amber-700 dark:text-amber-400";
    case "skipped":
      return "text-slate-600 dark:text-slate-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    case "queued":
      return "text-yellow-700 dark:text-yellow-300";
    case "processing":
      return "text-blue-700 dark:text-blue-400";
    default:
      return "";
  }
}

function getAnalysisStatusBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  const s = (status ?? "").trim();
  if (s === "queued") {
    return {
      label: "🟡 queued",
      className:
        "bg-yellow-500/15 text-yellow-200 ring-1 ring-yellow-500/30",
    };
  }
  if (s === "processing") {
    return {
      label: "🔵 processing",
      className: "bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/30",
    };
  }
  if (s === "completed") {
    return {
      label: "🟢 completed",
      className:
        "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30",
    };
  }
  if (s === "failed") {
    return {
      label: "🔴 failed",
      className: "bg-red-500/15 text-red-200 ring-1 ring-red-500/30",
    };
  }
  if (s === "warning" || s === "partial") {
    return {
      label: "🟠 warning",
      className:
        "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30",
    };
  }
  if (!s) {
    return {
      label: "—",
      className: "bg-zinc-500/10 text-zinc-300 ring-1 ring-zinc-500/20",
    };
  }
  return {
    label: s,
    className: "bg-zinc-500/10 text-zinc-200 ring-1 ring-zinc-500/20",
  };
}

function persistLevelClass(level: string | null | undefined): string {
  switch (level) {
    case "full":
      return "text-emerald-700 dark:text-emerald-400";
    case "partial_db":
      return "text-amber-700 dark:text-amber-400";
    case "minimal":
      return "text-orange-700 dark:text-orange-400";
    case "none":
      return "text-red-600 dark:text-red-400";
    default:
      return "";
  }
}

function analysisMessageClass(status: string | null | undefined): string {
  if (status === "failed") return "text-red-600 dark:text-red-400";
  if (status === "partial" || status === "warning") {
    return "text-amber-800 dark:text-amber-200";
  }
  if (status === "skipped") {
    return "text-slate-700 dark:text-slate-300";
  }
  return "text-red-600 dark:text-red-400";
}

function JsonBlock(props: { label: string; value: unknown }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{props.label}</h3>
      <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
        {JSON.stringify(props.value, null, 2)}
      </pre>
    </div>
  );
}

export function CallDetail(props: {
  call: CallRow;
  entities: CallEntityRow[];
  recommendations: ActionRecommendationRow[];
  operation_case: OperationCaseRow | null;
  service_request: ServiceRequestRow | null;
  reservation_lead: ReservationLeadRow | null;
  batchJobId: string | null;
  reviewLinks: CallDetailReviewLink[];
  reviewJobs: ReviewJobRow[];
}) {
  const {
    call,
    entities,
    recommendations,
    operation_case,
    service_request,
    reservation_lead,
    batchJobId,
    reviewLinks,
    reviewJobs,
  } = props;

  const hasWorkflow =
    operation_case != null ||
    service_request != null ||
    reservation_lead != null;
  const analysisBadge = getAnalysisStatusBadge(call.analysis_status);

  return (
    <div className="space-y-8">
      <CallDetailWorkbench
        call={call}
        batchJobId={batchJobId}
        reviewLinks={reviewLinks}
        reviewJobs={reviewJobs}
        actionsSlot={<CallDetailActions callId={call.id} />}
      />

      <section>
        <h2 className="text-lg font-semibold">STT / 분석 상태</h2>
        <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">STT</dt>
            <dd>
              {call.stt_status} {call.stt_provider ? `(${call.stt_provider})` : ""}{" "}
              {call.stt_confidence != null
                ? `· conf ${call.stt_confidence}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">분석</dt>
            <dd className={analysisStatusClass(call.analysis_status)}>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${analysisBadge.className}`}
              >
                {analysisBadge.label}
              </span>
              {call.analysis_confidence != null ? (
                <span className="ml-2 text-xs text-zinc-500">
                  conf {call.analysis_confidence}
                </span>
              ) : null}
            </dd>
          </div>
          {call.analysis_error_code ? (
            <div>
              <dt className="text-zinc-500">분석 코드</dt>
              <dd className="font-mono text-xs">{call.analysis_error_code}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-zinc-500">분석 버전</dt>
            <dd className="font-mono text-xs">{call.analysis_version ?? "—"}</dd>
          </div>
          {call.analysis_persist_level ? (
            <div>
              <dt className="text-zinc-500">DB persist</dt>
              <dd
                className={`font-mono text-xs ${persistLevelClass(call.analysis_persist_level)}`}
              >
                {call.analysis_persist_level}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-zinc-500">transcript_cleaned 길이</dt>
            <dd className="font-mono text-xs">
              {call.transcript_cleaned != null
                ? `${call.transcript_cleaned.length}자`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">analysis_input_text 길이</dt>
            <dd className="font-mono text-xs">
              {call.analysis_input_text != null
                ? `${call.analysis_input_text.length}자`
                : "—"}
            </dd>
          </div>
          {call.stt_error_message ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">STT 오류</dt>
              <dd className="text-red-600">{call.stt_error_message}</dd>
            </div>
          ) : null}
          {call.analysis_error_message ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">
                {call.analysis_status === "failed"
                  ? "분석 오류"
                  : "분석 메시지"}
              </dt>
              <dd className={analysisMessageClass(call.analysis_status)}>
                {call.analysis_error_message}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section>
        <h2 className="text-lg font-semibold">생성된 업무 레코드</h2>
        {!hasWorkflow ? (
          <p className="mt-2 text-sm text-zinc-500">
            생성된 업무 레코드 없음
          </p>
        ) : (
          <div className="mt-3 space-y-6">
            {operation_case ? (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Operation case
                </h3>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">id</dt>
                    <dd className="font-mono text-xs">{operation_case.id}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">case_type</dt>
                    <dd>{operation_case.case_type ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">room_no</dt>
                    <dd>{operation_case.room_no ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">issue_type</dt>
                    <dd>{operation_case.issue_type ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">title</dt>
                    <dd>{operation_case.title}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">status</dt>
                    <dd>{operation_case.status}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">severity</dt>
                    <dd>{operation_case.severity}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {service_request ? (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Service request
                </h3>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">id</dt>
                    <dd className="font-mono text-xs">{service_request.id}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">room_no</dt>
                    <dd>{service_request.room_no ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">item_requested</dt>
                    <dd>{service_request.item_requested ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">quantity / unit</dt>
                    <dd>
                      {service_request.quantity ?? "—"} /{" "}
                      {service_request.unit ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">title</dt>
                    <dd>{service_request.title}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">status</dt>
                    <dd>{service_request.status}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {reservation_lead ? (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Reservation lead
                </h3>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">id</dt>
                    <dd className="font-mono text-xs">{reservation_lead.id}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">phone_number</dt>
                    <dd>{reservation_lead.phone_number ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">lead_type</dt>
                    <dd>{reservation_lead.lead_type ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">arrival_eta</dt>
                    <dd>{reservation_lead.arrival_eta ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">title</dt>
                    <dd>{reservation_lead.title}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">status</dt>
                    <dd>{reservation_lead.status}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">견적서 초안</h2>
        <p className="mt-2 whitespace-pre-wrap rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          {call.quote_draft?.trim() ? call.quote_draft : "—"}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">요약 / 의도</h2>
        <p className="mt-2 text-sm">{call.summary ?? "—"}</p>
        <p className="mt-2 text-sm">
          <span className="font-medium">primary_intent:</span>{" "}
          {call.primary_intent ?? "—"}
        </p>
        <JsonBlock label="secondary_tags" value={call.secondary_tags} />
        <p className="mt-3 text-xs text-zinc-500">
          actionable_secondary_intents는 primary와 별도로, 같은 통화에 연관된
          업무 의도를 참고용으로만 표시합니다. (현재 워크플로는 primary만
          생성)
        </p>
        <JsonBlock
          label="actionable_secondary_intents"
          value={call.actionable_secondary_intents ?? null}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">엔티티</h2>
        {entities.length === 0 ? (
          <p className="text-sm text-zinc-500">엔티티 없음</p>
        ) : (
          entities.map((e) => (
            <div key={e.id} className="mt-3 space-y-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {(
                  [
                    ["room_no", e.room_no],
                    ["guest_name", e.guest_name],
                    ["issue_type", e.issue_type],
                    ["item_requested", e.item_requested],
                    ["quantity", e.quantity],
                    ["unit", e.unit],
                    ["arrival_eta", e.arrival_eta],
                    ["occupancy_count", e.occupancy_count],
                    ["checkin_date", e.checkin_date],
                    ["checkout_date", e.checkout_date],
                    ["quoted_price", e.quoted_price],
                    ["complaint_reason", e.complaint_reason],
                    ["amount", e.amount],
                    ["payment_method", e.payment_method],
                    ["payment_deposit", e.payment_deposit],
                    ["group_booking", e.group_booking],
                    ["room_count", e.room_count],
                    ["deposit_amount", e.deposit_amount],
                    ["parking_count", e.parking_count],
                  ] as [string, unknown][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-zinc-500">{k}</dt>
                    <dd>{v === null || v === undefined ? "—" : String(v)}</dd>
                  </div>
                ))}
              </dl>
              <JsonBlock label="extracted_json" value={e.extracted_json} />
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">추천 액션</h2>
        <div className="mt-2">
          <RecommendationList items={recommendations} />
        </div>
      </section>
    </div>
  );
}
