import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { matchRepository } from "@/repositories/match.repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLiveMatchAction, adminSettleAction } from "@/app/actions/match";
import Link from "next/link";

export default async function AdminMatchesPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");
  await connectDb();
  const matches = await matchRepository.list({});

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Clash Squad matches</h1>
      {matches.map((match) => (
        <Card key={String(match._id)}>
          <div className="flex items-center justify-between">
            <Link href={`/clash/${String(match._id)}`} className="font-bold">
              {match.format}v{match.format} • {match.status}
            </Link>
            <Badge>{match.acceptedStake ?? `${match.stakeMin}-${match.stakeMax}`}</Badge>
          </div>
          <form action={adminLiveMatchAction} className="mt-3 grid gap-2">
            <input type="hidden" name="matchId" value={String(match._id)} />
            <Label>Room ID</Label>
            <Input name="roomId" />
            <Label>Room password</Label>
            <Input name="roomPassword" type="password" />
            <Button type="submit" size="sm">
              Set live
            </Button>
          </form>
          <form action={adminSettleAction} className="mt-3 grid gap-2">
            <input type="hidden" name="matchId" value={String(match._id)} />
            <select name="winnerTeam" className="h-11 rounded-xl border border-white/10 bg-black/30 px-3">
              <option value="A">Team A (creator)</option>
              <option value="B">Team B (opponent)</option>
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Confirm winner & settle
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
