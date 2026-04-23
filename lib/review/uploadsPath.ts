import path from "path";

/**
 * 검수 Step1~3에서 사용하는 오디오 폴더.
 * 기본: 프로젝트 루트의 uploads/calls
 */
export function getReviewCallsUploadDir(): string {
  const env =
    process.env.REVIEW_CALLS_DIR?.trim() ||
    process.env.UPLOADS_CALLS_DIR?.trim();
  if (env) {
    return path.isAbsolute(env) ? env : path.join(process.cwd(), env);
  }
  return path.join(process.cwd(), "uploads", "calls");
}
