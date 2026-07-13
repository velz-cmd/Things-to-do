"use client";

import Image from "next/image";
import clsx from "clsx";
import {
  Bot,
  FileStack,
  FlaskConical,
  Link2,
  Radar,
  Wallet,
} from "lucide-react";
import { MissionPromptField } from "@/components/resolve/mission-control/mission-prompt-field";
import { BRAND_LOGO_PATH } from "@/lib/brand/assets";
import {
  MISSION_CREATOR_VALUE,
  MISSION_FUNDER_INTENTS,
} from "@/lib/mission/mission-lane-copy";

const QUICK_STARTS = [
  {
    id: "owed",
    label: "What am I owed?",
    detail: "Free earnings check",
    prompt: MISSION_CREATOR_VALUE.actions[0].prompt,
    icon: Wallet,
    tone: "mint",
  },
  {
    id: "gap",
    label: "Investigate gap",
    detail: "Map missing value",
    prompt: "Investigate the largest verified funding gap and show the evidence behind it.",
    icon: Radar,
    tone: "cyan",
  },
  {
    id: "blueprint",
    label: "Build Blueprint",
    detail: "Prepare payees + policy",
    prompt: "Generate a Capital Blueprint — show objective, evidence, payees, policy, and funding requirement.",
    icon: FileStack,
    tone: "violet",
  },
  {
    id: "simulate",
    label: "Simulate payout",
    detail: "Preview before capital moves",
    prompt: "Simulate allocating $5,000 across React maintainers — show recipients and amounts.",
    icon: FlaskConical,
    tone: "blue",
  },
  {
    id: "link",
    label: "Link work",
    detail: "Connect creator identity",
    prompt: MISSION_CREATOR_VALUE.actions[1].prompt,
    icon: Link2,
    tone: "cyan",
  },
  {
    id: "intel",
    label: "Hire intel",
    detail: "Verified signal from $0.001",
    prompt: MISSION_FUNDER_INTENTS[1].prompt,
    icon: Bot,
    tone: "amber",
  },
] as const;

export function MissionCommandHero({
  input,
  onInputChange,
  onSubmit,
  loading,
  className,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <section className={clsx("mission-start-workspace", className)} aria-labelledby="mission-start-title">
      <div className="mission-start-workspace__topline">
        <div>
          <p className="mission-kicker">Mission</p>
          <h1 id="mission-start-title">What decision do you want to make?</h1>
          <p>Ask what is owed, investigate a funding gap, or prepare a payout Blueprint.</p>
        </div>

        <div className="mission-start-route" aria-label="Question becomes evidence, policy, and Blueprint">
          <span>Question</span>
          <i aria-hidden />
          <span>Evidence</span>
          <span className="mission-start-route__mark" aria-hidden>
            <Image src={BRAND_LOGO_PATH} alt="" width={28} height={28} />
          </span>
          <i aria-hidden />
          <span>Policy</span>
          <i aria-hidden />
          <span>Blueprint</span>
        </div>
      </div>

      <MissionPromptField
        value={input}
        onChange={onInputChange}
        onSubmit={() => onSubmit(input.trim())}
        loading={loading}
        placeholder="Ask Mission or describe an objective…"
        className="mission-start-workspace__prompt"
      />

      <div className="mission-quick-starts">
        <p>Quick starts</p>
        <div role="list" aria-label="Mission quick starts">
          {QUICK_STARTS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="listitem"
                onClick={() => onSubmit(item.prompt)}
                disabled={loading}
                className={`mission-quick-start mission-quick-start--${item.tone}`}
                title={item.detail}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
