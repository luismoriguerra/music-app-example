// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SecondVoiceHowTo } from "@/components/SecondVoiceHowTo";

describe("SecondVoiceHowTo (013 US5, FR-017)", () => {
  it("stays collapsed until the learner opens it, and closes again", async () => {
    const user = userEvent.setup();
    render(
      <SecondVoiceHowTo
        mixOptions={[{ label: "Both", hint: "Hear both" }]}
        levels={["Easy", "Hard"]}
      />,
    );
    const guide = screen.getByTestId("second-voice-howto");
    expect(guide).not.toHaveAttribute("open");
    await user.click(screen.getByText("How to practice"));
    expect(guide).toHaveAttribute("open");
    await user.click(screen.getByText("How to practice"));
    expect(guide).not.toHaveAttribute("open");
  });

  it("names the options and levels it is given instead of fixed copy (SC-007)", () => {
    render(
      <SecondVoiceHowTo
        mixOptions={[
          { label: "Zeta voices", hint: "Hear zeta" },
          { label: "Omega part", hint: "Hear omega" },
        ]}
        levels={["Level One", "Level Two"]}
      />,
    );
    const guide = screen.getByTestId("second-voice-howto");
    for (const text of [
      "Zeta voices",
      "Hear zeta",
      "Omega part",
      "Hear omega",
      "Level One",
      "Level Two",
    ]) {
      expect(guide).toHaveTextContent(text);
    }
  });
});
