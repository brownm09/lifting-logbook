export default function CycleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The global app nav now lives in the (authed) shell (AppNav). This layout
  // just provides the <main> landmark for cycle routes.
  return <main>{children}</main>;
}
