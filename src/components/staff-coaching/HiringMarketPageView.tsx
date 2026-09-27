import Link from "next/link";
import {
  acceptStaffOfferAction,
  makeStaffOfferAction,
  negotiateStaffOfferAction,
} from "@/application/actions";
import { StaffEntityLink } from "@/components/entity/StaffEntityLink";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { StaffTermsDialog } from "@/components/staff-coaching/StaffTermsDialog";
import { STAFF_ROLE_DISPLAY } from "@/domain/entities/staff-roles";
import type { StaffRole } from "@/domain/entities/staff";
import { STAFF_DEFAULT_CONTRACT_YEARS } from "@/systems/staff-config";
import {
  applyStaffHiringMarketFilters,
  type StaffHiringMarketAgentView,
  type StaffHiringMarketView,
  type StaffOfferView,
} from "@/state/staff-hub-selectors";

function marketHref(saveId: string, role?: string, sort?: string): string {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (sort) params.set("sort", sort);
  const query = params.toString();
  return `/dashboard/${saveId}/staff-coaching/hiring-market${
    query ? `?${query}` : ""
  }`;
}

function chipClass(active: boolean): string {
  return `rounded-full border px-3 py-1 text-xs ${
    active
      ? "border-amber-600 text-amber-400"
      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
  }`;
}

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
      <PageHeader
        title="Hiring Market"
        subtitle="Free-agent staff available to hire"
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={marketHref(saveId, undefined, sort)}
          className={chipClass(!role)}
          aria-current={!role ? "page" : undefined}
        >
          All
        </Link>
        {view.roleFilters.map((roleId) => (
          <Link
            key={roleId}
            href={marketHref(saveId, roleId, sort)}
            className={chipClass(role === roleId)}
            aria-current={role === roleId ? "page" : undefined}
          >
            {STAFF_ROLE_DISPLAY[roleId as StaffRole] ??
              roleId.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {view.sortOptions.map((option) => (
          <Link
            key={option}
            href={marketHref(saveId, role, option)}
            className={chipClass((sort ?? "overall") === option)}
            aria-current={(sort ?? "overall") === option ? "page" : undefined}
          >
            Sort: {option}
          </Link>
        ))}
      </div>

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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-zinc-100">{name}</p>
                    <p className="text-zinc-500">
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
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <div>
        <p className="font-medium text-zinc-100">
          <StaffEntityLink saveId={saveId} staffId={member.staffId}>
            {member.firstName} {member.lastName}
          </StaffEntityLink>
        </p>
        <p className="text-sm text-zinc-400">
          {member.roleLabel} · OVR {member.overall} · POT {member.potential} ·
          Age {member.age}
        </p>
        <p className="text-xs text-zinc-500">
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
            className="rounded-md border border-amber-700/50 px-3 py-1.5 text-sm text-amber-300 hover:border-amber-600"
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
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Accept
          </button>
        </form>
      </div>
    );
  }

  return <StatusBadge label={offer.status} />;
}
