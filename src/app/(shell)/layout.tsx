import { ResolveTopNav } from "@/components/resolve/nav/top-nav";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-resolve-bg text-white">
      <ResolveTopNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
