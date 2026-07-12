"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Library, MessageSquarePlus, PanelLeftClose, PanelLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  formatSessionTime,
  loadMissionSessions,
  removeMissionSession,
  sessionDisplayTitle,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";
import { filterMeaningfulMissionSessions } from "@/lib/mission/mission-session-filter";
import {
  addMissionChatTombstone,
  filterOutTombstonedSessions,
} from "@/lib/mission/mission-chat-tombstones";
import {
  deleteServerMission,
  fetchMissions,
  isMissionServerAvailable,
  serverMissionToSession,
} from "@/lib/mission/client-api";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/resolve/ui/skeleton";

function sessionPreview(s: MissionSession): string {
  const userMsgs =
    s.userTurnCount ??
    s.turns?.filter((t) => t.role === "user").length ??
    0;
  const msgs = userMsgs > 0 ? `${userMsgs} message${userMsgs === 1 ? "" : "s"}` : "Empty";
  return `${formatSessionTime(s.updatedAt)} · ${msgs}`;
}

function applySidebarFilters(sessions: MissionSession[]): MissionSession[] {
  return filterMeaningfulMissionSessions(filterOutTombstonedSessions(sessions));
}

function sessionStatus(status?: string) {
  if (status === "completed") return { label: "Complete", tone: "complete" };
  if (status === "awaiting_user") return { label: "Review", tone: "review" };
  if (status === "executing" || status === "running") return { label: "Running", tone: "running" };
  return { label: "Draft", tone: "draft" };
}

function sessionDateGroup(updatedAt: string) {
  const ageDays = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  if (ageDays <= 0) return "Today";
  if (ageDays <= 7) return "Previous 7 days";
  return "Older";
}

/** Mission chat history — only conversations you started (user message required). */
export function MissionHistorySidebar({
  onNewMission,
  onSelectSession,
  onSessionDeleted,
  activeSessionId,
  libraryVersion = 0,
}: {
  onNewMission: () => void;
  onSelectSession: (session: MissionSession) => void;
  onSessionDeleted?: (sessionId: string) => void;
  activeSessionId?: string | null;
  libraryVersion?: number;
}) {
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<MissionSession[]>([]);
  const [storageMode, setStorageMode] = useState<"local" | "server" | "loading">("loading");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const groupedSessions = sessions.reduce<Record<string, MissionSession[]>>((groups, item) => {
    const group = sessionDateGroup(item.updatedAt);
    (groups[group] ??= []).push(item);
    return groups;
  }, {});

  const loadAll = useCallback(async () => {
    const serverAvailable = user ? await isMissionServerAvailable() : false;

    if (serverAvailable) {
      const missions = await fetchMissions();
      if (missions !== null) {
        setStorageMode("server");
        setSessions(
          applySidebarFilters(missions.map((m) => serverMissionToSession(m))),
        );
        return;
      }
    }

    setStorageMode("local");
    setSessions(applySidebarFilters(loadMissionSessions()));
  }, [user]);

  useEffect(() => {
    void loadAll();
  }, [libraryVersion, loadAll, user?.id]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1099px)").matches) {
      setCollapsed(true);
    }
  }, []);

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(id);
    addMissionChatTombstone(id);
    removeMissionSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));

    const isLocalOnly = id.startsWith("ms-");
    let serverOk = true;
    if (!isLocalOnly && user) {
      serverOk = await deleteServerMission(id);
    }

    setDeletingId(null);
    onSessionDeleted?.(id);

    if (!serverOk && !isLocalOnly) {
      toast.error("Could not remove chat from account", {
        description: "It stays hidden on this device. Refresh and try delete again if it reappears.",
      });
    }
  }

  if (collapsed) {
    return (
      <aside className="mission-history-sidebar mission-history-sidebar--collapsed">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mission-history-icon-btn"
          aria-label="Expand chats"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNewMission}
          className="mission-history-icon-btn mt-2"
          aria-label="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="mission-history-sidebar" data-testid="mission-chat-sidebar">
      <div className="flex items-center justify-between gap-2 border-b border-violet-400/10 px-3 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-violet-100/95">
          <Library className="h-3.5 w-3.5 text-violet-300" aria-hidden />
          Mission library
        </p>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="mission-history-icon-btn"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 py-2.5">
        <button type="button" onClick={onNewMission} className="mission-btn mission-btn--primary w-full">
          <MessageSquarePlus className="h-4 w-4 shrink-0" />
          New mission
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {storageMode === "loading" ? (
          <div className="space-y-2 px-1 py-2" aria-label="Loading chats" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-white/[0.04] p-2.5">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="mt-2 h-2.5 w-3/5" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-4 text-xs leading-relaxed text-resolve-muted-dim">
            {storageMode === "server"
              ? "Chats appear here after you send your first message."
              : "Chats save in this browser after you send a message."}
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSessions).map(([group, groupSessions]) => (
              <section key={group}>
                <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-resolve-muted-dim">{group}</p>
                <ul className="space-y-1">
            {groupSessions.map((s) => {
              const active = activeSessionId === s.id;
              const title = sessionDisplayTitle(s);
              const isDeleting = deletingId === s.id;
              const status = sessionStatus(s.status);
              return (
                <li key={s.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelectSession(s)}
                    className={clsx("mission-history-item", active && "mission-history-item--active")}
                  >
                    <span className="block truncate text-[13px] font-medium leading-snug">{title}</span>
                    <span className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-resolve-muted-dim">
                      <span className={`mission-session-status mission-session-status--${status.tone}`}>{status.label}</span>
                      <span className="truncate">{sessionPreview(s)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={(e) => void handleDeleteSession(s.id, e)}
                    className={clsx(
                      "mission-history-delete",
                      isDeleting && "opacity-40",
                    )}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-violet-400/10 px-3 py-3">
        {storageMode === "server" ? (
          <p className="text-[10px] leading-relaxed text-violet-200/70">Synced to your account</p>
        ) : user ? (
          <p className="text-[10px] leading-relaxed text-resolve-muted-dim">
            Local only — server sync unavailable
          </p>
        ) : (
          <p className="text-[10px] leading-relaxed text-resolve-muted-dim">
            <button type="button" onClick={() => openSignIn()} className="text-sky-300 hover:underline">
              Sign in
            </button>{" "}
            to sync chats
          </p>
        )}
      </div>
    </aside>
  );
}
