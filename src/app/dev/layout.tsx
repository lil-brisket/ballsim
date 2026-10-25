import { notFound } from "next/navigation";

type DevLayoutProps = {
  children: React.ReactNode;
};

/** Developer tools (sim lab, showcases) do not exist in production builds. */
export default function DevLayout({ children }: DevLayoutProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return children;
}
