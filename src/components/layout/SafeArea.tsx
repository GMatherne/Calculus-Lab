export function SafeArea({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom safe-x">
      {children}
    </div>
  );
}
