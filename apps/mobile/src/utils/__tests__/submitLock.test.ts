import { describe, expect, it } from "vitest";
import { createSubmitLock, runWithSubmitLock } from "../submitLock";

describe("runWithSubmitLock", () => {
  it("rejects duplicate submits while a request is in flight", async () => {
    const lock = createSubmitLock();
    let releaseFirstSubmit!: () => void;
    const firstSubmitGate = new Promise<void>((resolve) => {
      releaseFirstSubmit = resolve;
    });

    const firstSubmit = runWithSubmitLock(lock, async () => {
      await firstSubmitGate;
      return "first";
    });
    const duplicateSubmit = await runWithSubmitLock(lock, async () => "second");

    expect(duplicateSubmit).toEqual({ started: false });

    releaseFirstSubmit();
    await expect(firstSubmit).resolves.toEqual({ started: true, result: "first" });
  });

  it("releases the lock after a rejected submit so later submits can run", async () => {
    const lock = createSubmitLock();

    await expect(
      runWithSubmitLock(lock, async () => {
        throw new Error("network failure");
      })
    ).rejects.toThrow("network failure");

    const recoverySubmit = await runWithSubmitLock(lock, async () => "recovered");
    expect(recoverySubmit).toEqual({ started: true, result: "recovered" });
  });
});
