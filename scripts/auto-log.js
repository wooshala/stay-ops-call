const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const logFile = path.join(root, "WORK_LOG.md");

function run(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const now = new Date().toISOString().replace("T", " ").slice(0, 19);
const branch = run("git branch --show-current");
const recentCommits = run("git log --oneline -5");
const changedFiles = run("git diff --name-only HEAD");
const stagedFiles = run("git diff --cached --name-only");
const untrackedFiles = run("git ls-files --others --exclude-standard");

const hasChanges = changedFiles || stagedFiles || untrackedFiles;
if (!hasChanges) process.exit(0);

const entry = [
  `\n## ${now} (${branch})`,
  recentCommits ? `\n### 최근 커밋\n\`\`\`\n${recentCommits}\n\`\`\`` : "",
  changedFiles ? `\n### 변경된 파일\n${changedFiles.split("\n").map(f => `- ${f}`).join("\n")}` : "",
  stagedFiles ? `\n### 스테이징된 파일\n${stagedFiles.split("\n").map(f => `- ${f}`).join("\n")}` : "",
  untrackedFiles ? `\n### 새 파일\n${untrackedFiles.split("\n").map(f => `- ${f}`).join("\n")}` : "",
].filter(Boolean).join("\n");

if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, "# 작업 이력 자동 로그\n");
}

fs.appendFileSync(logFile, entry + "\n");
