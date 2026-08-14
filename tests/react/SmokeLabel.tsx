/**
 * Trivial presentational component used only to prove React/jsdom
 * Testing Library infrastructure works. Not part of the application UI.
 */
export function SmokeLabel({ label }: { label: string }) {
  return <p role="status">{label}</p>;
}
