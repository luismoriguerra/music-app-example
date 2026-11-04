// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  SecondVoiceExerciseCard,
  type SecondVoiceExerciseCardProps,
} from "@/components/SecondVoiceExerciseCard";
import type { SecondVoiceStepRow } from "@/lib/second-voice-exercises";

const ROWS: SecondVoiceStepRow[] = [
  {
    leadNote: "C",
    leadDegree: 1,
    yourNote: "E",
    yourDegree: 3,
    interval: "3rd above",
  },
  {
    leadNote: "D",
    leadDegree: 2,
    yourNote: "F",
    yourDegree: 4,
    interval: "3rd above",
  },
  {
    leadNote: "E",
    leadDegree: 3,
    yourNote: "G",
    yourDegree: 5,
    interval: "3rd above",
  },
];

function renderCard(
  overrides: Partial<SecondVoiceExerciseCardProps> = {},
): SecondVoiceExerciseCardProps {
  const props: SecondVoiceExerciseCardProps = {
    id: "parallel-3rd-above",
    title: "Parallel 3rds above",
    description: "Sing a 3rd above the lead, moving with it.",
    technique: "parallel",
    rows: ROWS,
    loopCount: 3,
    onLoopCountChange: vi.fn(),
    audioAvailable: true,
    run: null,
    onPlay: vi.fn(),
    onLoop: vi.fn(),
    onStop: vi.fn(),
    onStepPreview: vi.fn(),
    ...overrides,
  };
  render(
    <ul>
      <SecondVoiceExerciseCard {...props} />
    </ul>,
  );
  return props;
}

describe("SecondVoiceExerciseCard (013 FR-006, FR-008, FR-012)", () => {
  it("lists each step with its lead note, your part, and interval", () => {
    renderCard();
    const steps = screen.getAllByTestId("second-voice-step");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Lead C");
    expect(steps[0]).toHaveTextContent("You E");
    expect(steps[0]).toHaveTextContent("3rd above");
  });

  it("badges the technique", () => {
    renderCard({ technique: "independence" });
    expect(screen.getByTestId("second-voice-technique")).toHaveTextContent(
      "Independence",
    );
  });

  it("Play starts the exercise when it is idle", async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(
      screen.getByRole("button", { name: "Play Parallel 3rds above" }),
    );
    expect(props.onPlay).toHaveBeenCalledTimes(1);
    expect(props.onStop).not.toHaveBeenCalled();
  });

  it("Play shows Stop while this exercise plays and stops it on press", async () => {
    const user = userEvent.setup();
    const props = renderCard({ run: { mode: "play", loops: 1, position: 0 } });
    await user.click(
      screen.getByRole("button", { name: "Stop Parallel 3rds above" }),
    );
    expect(props.onStop).toHaveBeenCalledTimes(1);
    expect(props.onPlay).not.toHaveBeenCalled();
  });

  it("Loop names its round count and starts a loop when idle", async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(
      screen.getByRole("button", {
        name: "Loop Parallel 3rds above 3 times",
      }),
    );
    expect(props.onLoop).toHaveBeenCalledTimes(1);
  });

  it("a running loop reports its round and step and marks the current step", () => {
    renderCard({ run: { mode: "loop", loops: 3, position: 4 } });
    // Position 4 over three steps per round is round 2, step 2.
    expect(screen.getByTestId("second-voice-progress")).toHaveTextContent(
      "Round 2 of 3",
    );
    expect(screen.getByTestId("second-voice-progress")).toHaveTextContent(
      "Step 2 of 3",
    );
    expect(
      screen.getByTestId("second-voice-exercise-parallel-3rd-above"),
    ).toHaveAttribute("aria-busy", "true");
    const steps = screen.getAllByTestId("second-voice-step");
    expect(steps[1]).toHaveAttribute("aria-current", "true");
    expect(steps[0]).not.toHaveAttribute("aria-current");
  });

  it("a tapped step previews that step", async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(screen.getByRole("button", { name: /^Play step 2:/ }));
    expect(props.onStepPreview).toHaveBeenCalledWith(1);
  });

  it("the round select reports the chosen count", async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.selectOptions(
      screen.getByLabelText("Loop rounds for Parallel 3rds above"),
      "5",
    );
    expect(props.onLoopCountChange).toHaveBeenCalledWith(5);
  });

  it("disables Play, Loop, and step previews when audio is unavailable", () => {
    renderCard({ audioAvailable: false });
    expect(
      screen.getByRole("button", { name: "Play Parallel 3rds above" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Loop Parallel 3rds above 3 times" }),
    ).toBeDisabled();
    for (const step of screen.getAllByTestId("second-voice-step")) {
      expect(step).toBeDisabled();
    }
  });
});
