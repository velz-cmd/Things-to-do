"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { MessageSquarePlus, PanelLeftClose, PanelLeft, Trash2 } from "lucide-react";
import {
  formatSessionTime,
  loadMissionSessions,
  removeMissionSession,
  sessionDisplayTitle,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";
import {
  deleteServerMission,
  fetchMissions,
  isMissionServerAvailable,
  serverMissionToSession,
} from "@/lib/mission/client-api";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuth } from "@/components/auth/auth-provider";

function sessionPreview(s: MissionSession): string {
  const turns = s.turnCount ?? s.turns?.length ?? 0;
  const msgs = turns > 0 ? `${turns} message${turns === 1 ? "" : "s"}` : "Empty";
  return `${formatSessionTime(s.updatedAt)} · ${msgs}`;
}

/** ChatGPT-style mission history — real local or server persistence only. */
export function MissionHistorySidebar({
  onNewMission,
  onSelectSession,
  activeSessionId,
  libraryVersion = 0,
}: {
  onNewMission: () => void;
  onSelectSession: (session: MissionSession) => void;
  activeSessionId?: string | null;
  libraryVersion?: number;
}) {
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<MissionSession[]>([]);
  const [storageMode, setStorageMode] = useState<"local" | "server" | "loading">("loading");

  const loadAll = useCallback(async () => {
    const serverAvailable = user ? await isMissionServerAvailable() : false;

    if (serverAvailable) {
      const missions = await fetchMissions();
      if (missions !== null) {
        setStorageMode("server");
        setSessions(
          missions
            .map((m) => serverMissionToSession(m))
            .filter((s) => s.title !== "New mission" || (s.turnCount ?? 0) > 0),
        );
        return;
      }
    }

    setStorageMode("local");
    setSessions(
      loadMissionSessions().filter(
        (s) => (s.turns?.length ?? 0) > 0 || (s.query?.trim() && s.title !== "New mission"),
      ),
    );
  }, [user]);

  useEffect(() => {
    void loadAll();
  }, [libraryVersion, loadAll, user?.id]);

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (storageMode === "server") await deleteServerMission(id);
    else removeMissionSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (collapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#060a12] py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-lg p-2 text-resolve-muted transition hover:bg-white/[0.05] hover:text-white"
          aria-label="Expand chats"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNewMission}
          className="mt-2 rounded-lg p-2 text-resolve-muted transition hover:bg-white/[0.05] hover:text-white"
          aria-label="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-[#060a12]"
      data-testid="mission-chat-sidebar"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-3">
        <p className="text-sm font-medium text-white">Chats</p>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg p-1.5 text-resolve-muted transition hover:bg-white/[0.05] hover:text-white"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 py-2">
        <button
          type="button"
          onClick={onNewMission}
          className="flex w-full items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.07]"
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {storageMode === "loading" ? (
          <p className="px-2 py-4 text-xs text-resolve-muted-dim">Loading chats…</p>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-4 text-xs leading-relaxed text-resolve-muted-dim">
            {storageMode === "server"
              ? "No chats yet. Start a mission — it saves here automatically."
              : "Chats save in this browser. Sign in to sync across devices."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => {
              const active = activeSessionId === s.id;
              const title = sessionDisplayTitle(s);
              return (
                <li key={s.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelectSession(s)}
                    className={clsx(
                      "w-full rounded-lg px-3 py-2.5 pr-8 text-left transition",
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-resolve-muted hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <span className="block truncate text-[13px] font-medium leading-snug">
                      {title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-resolve-muted-dim">
                      {sessionPreview(s)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void handleDeleteSession(s.id, e)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-transparent opacity-0 transition group-hover:opacity-100 hover:!text-rose-300 group-hover:text-resolve-muted-dim"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
        {storageMode === "server" ? (
          <p className="text-[10px] leading-relaxed text-emerald-300/80">
            Saved to your account
          </p>
        ) : user ? (
          <p className="text-[10px] leading-relaxed text-resolve-muted-dim">
            Saving locally — server sync unavailable
          </p>
        ) : (
          <p className="text-[10px] leading-relaxed text-resolve-muted-dim">
            <button
              type="button"
              onClick={() => openSignIn()}
              className="text-sky-300 hover:underline"
            >
              Sign in
            </button>{" "}
            to save chats across devices
          </p>
        )}
      </div>
    </aside>
  );
}
