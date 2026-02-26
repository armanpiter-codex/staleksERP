export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-staleks-bg">{children}</div>;
}
