import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Button asChild>
        <Link href="/lobby">Back to lobby</Link>
      </Button>
    </div>
  );
}
