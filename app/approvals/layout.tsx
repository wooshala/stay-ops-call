import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 예약 승인",
};

export default function ApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
