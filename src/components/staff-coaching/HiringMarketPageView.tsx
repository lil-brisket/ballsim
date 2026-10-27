import { buttonClass } from "@/components/ui/Button";
import {
  acceptStaffOfferAction,
  makeStaffOfferAction,
  negotiateStaffOfferAction,
} from "@/application/actions";
import { StaffEntityLink } from "@/components/entity/StaffEntityLink";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { HiringMarketFilters } from "@/components/staff-coaching/HiringMarketFilters";
import { StaffTermsDialog } from "@/components/staff-coaching/StaffTermsDialog";
import { STAFF_DEFAULT_CONTRACT_YEARS } from "@/systems/staff-config";
import {
  applyStaffHiringMarketFilters,
  type StaffHiringMarketAgentView,
  type StaffHiringMarketView,
  type StaffOfferView,
} from "@/state/staff-hub-selectors";

export function HiringMarketPageView(props: {
  view: StaffHiringMarketView;
  returnPath: string;
  error?: string;
  role?: string;
  sort?: string;
}) {
  const { view, returnPath, error, role, sort } = props;
  const saveId = view.saveId;
  const filtered = applyStaffHiringMarketFilters(view, role, sort);
  const listed = filtered.slice(0, 40);
  const openOffers = Object.values(view.activeOffers);

  return (
    <div className="space-y-4">
      <PageHeader title="Hiring Market" />
      {error ? <ErrorState message={error} /> : null}

      <HiringMarketFilters
        saveId={saveId}
        roles={view.roleFilters.map((id) => ({
          id,
          count: view.freeAgents.filter((agent) => agent.role === id).length,
        }))}
        role={role ?? ""}
        sort={sort ?? "overall"}
        sortOptions={view.sortOptions}
        totalCount={filtered.length}
        shownCount={listed.length}
      />

      {openOffers.length > 0 ? (
        <Section title="My Offers">
          <ul className="space-y-2">
            {openOffers.map((offer) => {
              const member = view.freeAgents.find(
                (agent) => agent.staffId === offer.staffId,
              );
              const name = member
                ? `${member.firstName} ${member.lastName}`
                : offer.staffId;
              return (
                <li
                  key={offer.offerId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-ink">{name}</p>
                    <p className="text-faint">
                      {offer.years}y ·{" "}
                      <MoneyDisplay amount={offer.annualSalary} />
                    </p>
                  </div>
                  <StatusBadge label={offer.status} />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Section title="Available staff">
        {listed.length === 0 ? (
          <EmptyState message="No unemployed staff available." />
        ) : (
          <ul className="space-y-2">
            {listed.map((member) => (
              <HireMarketRow
                key={member.staffId}
                saveId={saveId}
                member={member}
                offer={view.activeOffers[member.staffId]}
                returnPath={returnPath}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function HireMarketRow(props: {
  saveId: string;
  member: StaffHiringMarketAgentView;
  offer?: StaffOfferView;
  returnPath: string;
}) {
  const { saveId, member, offer, returnPath } = props;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-base/40 px-4 py-3">
      <div>
        <p className="font-medium text-ink">
          <StaffEntityLink saveId={saveId} staffId={member.staffId}>
            {member.firstName} {member.lastName}
          </StaffEntityLink>
        </p>
        <p className="text-sm text-muted">
          {member.roleLabel} · OVR {member.overall} · POT {member.potential} ·
          Age {member.age}
        </p>
        <p className="text-sm text-faint">
          Wants ~<MoneyDisplay amount={member.desiredSalary} /> · Min{" "}
          <MoneyDisplay amount={member.minimumSalary} />
        </p>
      </div>
      <MarketActions
        saveId={saveId}
        member={member}
        offer={offer}
        returnPath={returnPath}
      />
    </li>
  );
}

function MarketActions(props: {
  saveId: string;
  member: StaffHiringMarketAgentView;
  offer?: StaffOfferView;
  returnPath: string;
}) {
  const { saveId, member, offer, returnPath } = props;
  if (!offer) {
    return (
      <StaffTermsDialog
        title={`Offer to ${member.firstName} ${member.lastName}`}
        triggerLabel="Make Offer"
        submitLabel="Submit Offer"
        action={makeStaffOfferAction}
        saveId={saveId}
        returnPath={returnPath}
        hiddenFields={{ staffId: member.staffId }}
        defaultAnnualSalary={member.desiredSalary}
        defaultYears={STAFF_DEFAULT_CONTRACT_YEARS}
        askingSalary={member.desiredSalary}
        interestLevel={member.askingInterest.level}
      />
    );
  }

  if (offer.status === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label="Offer pending" tone="warning" />
        <form action={negotiateStaffOfferAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="offerId" value={offer.offerId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className={buttonClass({ variant: "secondary" })}
          >
            Negotiate
          </button>
        </form>
      </div>
    );
  }

  if (offer.status === "negotiating") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label="Negotiating" tone="info" />
        <form action={acceptStaffOfferAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="offerId" value={offer.offerId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button type="submit" className={buttonClass({ variant: "primary" })}>
            Accept
          </button>
        </form>
      </div>
    );
  }

  return <StatusBadge label={offer.status} />;
}
