import type { Metadata } from "next";
import { cn, linkClass } from "@/components/ui/styles";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { TaxLineNote } from "@/components/finances/PayrollRulesPanel";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  advanceDayAction,
  finishFreeAgencyAction,
  makeFreeAgentOfferAction,
  signFreeAgentAction,
  withdrawFreeAgentOfferAction,
} from "@/application/actions";
import { getRequestSaveStore } from "@/application/request-save-store";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { buttonClass } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Metric } from "@/components/ui/Metric";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { splitDisplayName } from "@/presentation/portrait-hash";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { FreeAgentInterest } from "@/components/free-agency/FreeAgentInterest";
import { IncomingOfferSheets } from "@/components/rfa/IncomingOfferSheets";
import { OutgoingOfferSheets } from "@/components/rfa/OutgoingOfferSheets";
import { RfaBadge } from "@/components/rfa/RfaBadge";
import { RfaOfferSheetAction } from "@/components/rfa/RfaOfferSheetAction";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";
import { OvrBadge } from "@/components/ui/OvrBadge";

export const metadata: Metadata = { title: "Free Agency" };

type FreeAgencyPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function FreeAgencyPage({
  params,
  searchParams,
}: FreeAgencyPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) {
    notFound();
  }

  const hub = toFreeAgencyHubView(loaded.state);
  const returnPath = `/dashboard/${saveId}/free-agency`;
  const calendarHref = `/dashboard/${saveId}/calendar`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Free Agency"
        subtitle={
          hub.active
            ? hub.inSeason
              ? `${hub.teamName} · In-season signings`
              : `${hub.teamName} · Cap space available`
            : (hub.inactiveReason ?? "Offseason free agency")
        }
        actions={
          <Link
            href={calendarHref}
            className={buttonClass({ variant: "secondary" })}
          >
            Open Calendar
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div
        className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-line bg-surface-raised/40 px-4 py-3"
        aria-label="Free agency summary"
      >
        <Metric
          label="Payroll"
          value={<MoneyDisplay amount={hub.playerPayroll} />}
          density="compact"
        />
        <Metric
          label="Cap space"
          value={<MoneyDisplay amount={hub.capSpace} />}
          density="compact"
        />
        <Metric
          label="Roster"
          value={String(hub.rosterCount)}
          density="compact"
        />
        <Metric
          label="Available"
          value={String(hub.availableCount)}
          density="compact"
        />
      </div>

      <TaxLineNote rules={hub.payrollRules} />

      {!hub.active ? (
        <EmptyState
          message={hub.inactiveReason ?? "Free agency is not active."}
        />
      ) : (
        <>
          {hub.rfa.enabled && hub.rfa.incomingSheets.length > 0 ? (
            <Section title="Offer sheets to answer">
              <IncomingOfferSheets
                sheets={hub.rfa.incomingSheets}
                saveId={saveId}
                returnPath={returnPath}
              />
            </Section>
          ) : null}

          {hub.decisions.length > 0 ? (
            <ManagementDecisionPanel
              title="Free Agency Decisions"
              items={hub.decisions}
              saveId={saveId}
              currentDate={hub.currentDate}
            />
          ) : null}

          {hub.inSeason ? null : (
            <Section
              title="My Offers"
              action={
                <form action={advanceDayAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <button
                    type="submit"
                    className={buttonClass({ variant: "secondary" })}
                  >
                    Sim 1 day
                  </button>
                </form>
              }
            >
              <p className="mb-2 text-sm text-faint">
                Free agents answer standing offers each day. Sim a day to see
                who signs.
              </p>
              {hub.offers.length === 0 ? (
                <EmptyState message="No offers from your team yet." />
              ) : (
                <ul className="space-y-2">
                  {hub.offers.map((offer) => (
                    <li
                      key={offer.offerId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-sm"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <PlayerPortrait
                          playerId={offer.playerId}
                          portrait={selectPlayerPortrait(
                            loaded.state,
                            offer.playerId,
                          )}
                          firstName={
                            splitDisplayName(offer.playerName).firstName
                          }
                          lastName={splitDisplayName(offer.playerName).lastName}
                          size="sm"
                        />
                        <div>
                          <p className="text-ink">
                            <PlayerEntityLink
                              saveId={saveId}
                              playerId={offer.playerId}
                            >
                              {offer.playerName}
                            </PlayerEntityLink>
                          </p>
                          <p className="text-faint">
                            {offer.years}y ·{" "}
                            {offer.salary !== null ? (
                              <MoneyDisplay amount={offer.salary} />
                            ) : (
                              "—"
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge label={offer.status} />
                        {offer.status === "pending" ||
                        offer.status === "negotiating" ? (
                          <ConfirmDialog
                            title="Withdraw offer"
                            description={`Withdraw the open offer for ${offer.playerName}.`}
                            confirmLabel="Withdraw"
                          >
                            <form action={withdrawFreeAgentOfferAction}>
                              <input
                                type="hidden"
                                name="saveId"
                                value={saveId}
                              />
                              <input
                                type="hidden"
                                name="offerId"
                                value={offer.offerId}
                              />
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <button
                                type="submit"
                                className={buttonClass({ variant: "danger" })}
                              >
                                Confirm withdraw
                              </button>
                            </form>
                          </ConfirmDialog>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {hub.rfa.enabled && hub.rfa.outgoingSheets.length > 0 ? (
            <Section title="Your offer sheets">
              <OutgoingOfferSheets sheets={hub.rfa.outgoingSheets} />
            </Section>
          ) : null}

          <Section title="Available Players">
            <p className="mb-2 text-sm text-faint">
              Overall ratings shown match the existing free-agency information
              model (true OVR).
            </p>
            {hub.market.length === 0 ? (
              <EmptyState message="No free agents available." />
            ) : (
              <DataTable headers={["Player", "Pos", "Age", "OVR", "Actions"]}>
                {hub.market.slice(0, 40).map((agent) => {
                  const rfaTag = hub.rfa.enabled
                    ? (hub.rfaTags[agent.playerId] ?? null)
                    : null;
                  const interest = hub.interest[agent.playerId] ?? null;
                  return (
                    <tr key={agent.playerId} className="border-t border-line">
                      <td className="px-3 py-2 text-ink">
                        <span className="flex items-center gap-2">
                          <PlayerPortrait
                            playerId={agent.playerId}
                            portrait={selectPlayerPortrait(
                              loaded.state,
                              agent.playerId,
                            )}
                            firstName={agent.firstName}
                            lastName={agent.lastName}
                            size="sm"
                          />
                          <PlayerEntityLink
                            saveId={saveId}
                            playerId={agent.playerId}
                          >
                            {agent.firstName} {agent.lastName}
                          </PlayerEntityLink>
                          {rfaTag ? <RfaBadge tag={rfaTag} /> : null}
                        </span>
                        {interest ? <FreeAgentInterest {...interest} /> : null}
                      </td>
                      <td className="px-3 py-2 text-muted">{agent.position}</td>
                      <td className="px-3 py-2 text-muted">{agent.age}</td>
                      <td className="px-3 py-2">
                        <OvrBadge
                          overall={agent.overall}
                          size="sm"
                          className="align-middle"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {rfaTag ? (
                          <RfaOfferSheetAction
                            saveId={saveId}
                            playerId={agent.playerId}
                            playerName={`${agent.firstName} ${agent.lastName}`}
                            returnPath={returnPath}
                            tag={rfaTag}
                          />
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            <form
                              action={signFreeAgentAction}
                              className="flex gap-2"
                            >
                              <input
                                type="hidden"
                                name="saveId"
                                value={saveId}
                              />
                              <input
                                type="hidden"
                                name="playerId"
                                value={agent.playerId}
                              />
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <NumberStepper
                                name="salary"
                                defaultValue={
                                  interest?.salaryToSign ?? 2_000_000
                                }
                                step={50_000}
                                min={0}
                                inputClassName="w-28"
                                aria-label="Salary"
                              />
                              <NumberStepper
                                name="years"
                                defaultValue={1}
                                min={1}
                                aria-label="Years"
                              />
                              <button
                                type="submit"
                                className={cn(linkClass, "text-sm")}
                              >
                                Sign
                              </button>
                            </form>
                            {hub.inSeason ? null : (
                              <form
                                action={makeFreeAgentOfferAction}
                                className="flex gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="saveId"
                                  value={saveId}
                                />
                                <input
                                  type="hidden"
                                  name="playerId"
                                  value={agent.playerId}
                                />
                                <input
                                  type="hidden"
                                  name="returnPath"
                                  value={returnPath}
                                />
                                <input
                                  type="hidden"
                                  name="salary"
                                  value={interest?.salaryToSign ?? 2_000_000}
                                />
                                <input type="hidden" name="years" value={1} />
                                <button
                                  type="submit"
                                  className="text-sm text-muted hover:text-team-ink"
                                >
                                  Offer
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </Section>

          {hub.inSeason ? null : (
            <details className="rounded-lg border border-line px-4 py-3 text-sm text-muted">
              <summary className="cursor-pointer text-soft">
                Finish free agency (legacy domain action)
              </summary>
              <p className="mt-2 text-sm text-faint">
                Prefers Calendar for progression. This pre-existing action
                advances the league phase and one simulation day.
              </p>
              <form action={finishFreeAgencyAction} className="mt-3">
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className={buttonClass({ variant: "secondary" })}
                >
                  Finish free agency
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </div>
  );
}
