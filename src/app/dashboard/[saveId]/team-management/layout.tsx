type LayoutProps = {
  children: React.ReactNode;
};

/**
 * Team management pages. Team identity and the team switcher live in the
 * game header; sub-navigation is the shared TeamHubSubNav row on each page.
 */
export default function TeamManagementLayout({ children }: LayoutProps) {
  return <div className="space-y-6">{children}</div>;
}
