import { ResolveSidebar } from "@/components/resolve/sidebar";
import { ResolveTopBar } from "@/components/resolve/top-bar";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-deputy-bg text-white">
      <ResolveSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ResolveTopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
