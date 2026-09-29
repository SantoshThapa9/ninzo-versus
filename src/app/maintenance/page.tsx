import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MaintenancePage() {
  return (
    <div className="grid gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Under Maintenance</h1>
      <p className="text-muted-foreground">
        We are updating the app to bring you new features. We will be back
        shortly!
      </p>
      {/* Optional: Add a button to let them check status or try again */}
      <Button asChild className="w-fit justify-self-center">
        <Link href="/">Try Again</Link>
      </Button>
    </div>
  );
}
