import Link from "next/link";
import { ResolveSidebar } from "@/components/resolve/sidebar";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-deputy-bg text-white">
      <ResolveSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
