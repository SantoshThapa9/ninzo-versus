"use client";

import { useActionState, useCallback, useState } from "react";
import { saveProfileAction, type SaveProfileState } from "@/app/actions/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileDetailsForm({
  displayName,
  ign,

  age,
  upiId,
  phoneNumber,
}: {
  displayName: string;
  ign: string;
  age: number | null;
  upiId: string;
  phoneNumber: string;
}) {
  const [showAgeInput, setShowAgeInput] = useState(age === null);
  const [currentAge, setCurrentAge] = useState(age);
  const [wantsSubscriptions, setWantsSubscriptions] = useState(
    Boolean(upiId || phoneNumber),
  );
  const submitProfile = useCallback(
    async (
      previous: SaveProfileState,
      formData: FormData,
    ): Promise<SaveProfileState> => {
      const result = await saveProfileAction(previous, formData);
      if (typeof result?.age === "number") {
        setCurrentAge(result.age);
        setShowAgeInput(false);
      }
      return result;
    },
    [],
  );
  const [state, formAction, saving] = useActionState<
    SaveProfileState,
    FormData
  >(submitProfile, null);

  return (
    <form action={formAction} className="grid gap-3">
      <div>
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={24}
        />
      </div>
      <div>
        <Label htmlFor="ign">In Game Name</Label>
        <Input
          id="ign"
          name="ign"
          defaultValue={ign}
          required
          data-tour="ign"
        />
      </div>
      <div>
        <Label htmlFor="profileAge">Age</Label>
        <Input
          id="profileAge"
          name="age"
          type="number"
          min={1}
          max={120}
          step={1}
          inputMode="numeric"
          defaultValue={currentAge ?? undefined}
        />
      </div>

      {!showAgeInput && currentAge !== null && currentAge >= 18 ? (
        <div className="grid gap-3">
          <label
            htmlFor="wantsSubscriptions"
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              id="wantsSubscriptions"
              type="checkbox"
              checked={wantsSubscriptions}
              onChange={(event) => setWantsSubscriptions(event.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Do you want to buy in-app subscriptions?
          </label>
          {wantsSubscriptions ? (
            <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div>
                <Label htmlFor="profileUpiId">UPI ID</Label>
                <Input
                  id="profileUpiId"
                  name="upiId"
                  defaultValue={upiId}
                  placeholder="name@bank"
                  autoComplete="off"
                  maxLength={100}
                  pattern="[A-Za-z0-9._-]+@[A-Za-z0-9.-]+"
                  title="Enter a valid UPI ID, such as name@bank."
                />
              </div>
              <div>
                <Label htmlFor="profilePhoneNumber">Phone number</Label>
                <Input
                  id="profilePhoneNumber"
                  name="phoneNumber"
                  type="tel"
                  defaultValue={phoneNumber}
                  placeholder="+919876543210"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={16}
                  pattern="\+?[1-9][0-9]{7,14}"
                  title="Enter a phone number with 8 to 15 digits."
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm text-[var(--accent-2)]">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="full" disabled={saving}>
        {saving ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}
