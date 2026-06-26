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
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-6">
      {sidebar}
      <div className="min-w-0 flex-1">{main}</div>
      {activity}
    </div>
  );
}
