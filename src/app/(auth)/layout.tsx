/**
 * Auth routes — no sidebar, header, or app chrome.
 * Login first; shell only after a valid session.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      {children}
    </div>
  );
}
