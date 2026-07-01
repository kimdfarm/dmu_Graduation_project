import { Outlet } from "react-router";
import { Toaster } from "sonner";

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-200 flex justify-center items-center font-sans text-slate-900 sm:py-8 overflow-hidden">
      <div className="w-full sm:w-[400px] h-[100dvh] sm:h-[800px] bg-slate-50 sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col relative sm:border-[8px] sm:border-slate-800">
        <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-center" expand={false} richColors />
    </div>
  );
}
