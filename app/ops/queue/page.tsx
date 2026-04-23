import { OpsQueueClient } from "./_components/OpsQueueClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Operations Queue",
};

export default function OpsQueuePage() {
  return <OpsQueueClient />;
}
