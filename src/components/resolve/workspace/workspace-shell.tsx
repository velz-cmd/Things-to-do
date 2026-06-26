"use client";

export function WorkspaceShell({
  sidebar,
  main,
  activity,
}: {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  activity: React.ReactNode;
}) {
  return (
    <div className="-mx-4 flex max-w-none gap-6 px-0 py-2 lg:-mx-6">
      {sidebar}
      <div className="min-w-0 flex-1">{main}</div>
      {activity}
    </div>
  );
}
