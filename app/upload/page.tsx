import { UploadForm } from "@/components/upload/UploadForm";

export const metadata = {
  title: "통화 업로드 · Stay-Ops-Call",
};

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">통화 업로드</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        저장 시 서버에서 STT → 분석 → 업무 레코드 생성까지 자동 처리됩니다.
        상세 화면에서 결과를 바로 확인할 수 있습니다.
      </p>
      <div className="mt-8">
        <UploadForm />
      </div>
    </main>
  );
}
