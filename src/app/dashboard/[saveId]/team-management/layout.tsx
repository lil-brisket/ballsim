type LayoutProps = {
  children: React.ReactNode;
};

/**
 * Team management pages. Team identity and the team switcher live in the
 * game header; sub-navigation is the Team hub sub-tab row in the shell.
 */
export default function TeamManagementLayout({ children }: LayoutProps) {
  return <div className="space-y-6">{children}</div>;
}
