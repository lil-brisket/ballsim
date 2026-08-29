import { createStaffOffer, isOpenStaffOffer, type StaffOffer } from "@/domain/entities/staff-offer";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import {
  asStaffOfferId,
  type StaffId,
  type StaffOfferId,
  type TeamId,
} from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { hireStaff } from "@/systems/staff";
import { evaluateStaffInterest } from "@/systems/staff-interest";
import { invalidateStaffOffers } from "@/systems/staff-contract-lifecycle";

export type MakeStaffOfferInput = {
  id?: StaffOfferId;
  staffId: StaffId;
  teamId: TeamId;
  annualSalary: number;
  years: number;
};

export function listStaffFreeAgents(state: GameState): StaffId[] {
  return Object.values(state.world.staff)
    .filter((s) => s.teamId === null)
    .map((s) => s.id)
    .sort();
}

export function makeStaffOffer(
  state: GameState,
  input: MakeStaffOfferInput,
): SystemResult {
  const staff = state.world.staff[input.staffId];
  if (!staff) {
    throw new Error(`makeStaffOffer: staff "${input.staffId}" not found.`);
  }
  if (staff.teamId !== null) {
    throw new Error(`makeStaffOffer: staff is already employed.`);
  }
  if (!state.world.teams[input.teamId]) {
    throw new Error(`makeStaffOffer: team not found.`);
  }

  const today = state.world.calendar.currentDate;
  const id =
    input.id ??
    asStaffOfferId(`staff_offer_${input.staffId}_${input.teamId}_${today}`);

  if (state.world.staffMarket.offers[id]) {
    throw new Error(`Staff offer "${id}" already exists.`);
  }

  for (const existing of Object.values(state.world.staffMarket.offers)) {
    if (
      existing.staffId === input.staffId &&
      existing.teamId === input.teamId &&
      isOpenStaffOffer(existing.status)
    ) {
      throw new Error(
        `Team already has an open offer for staff "${input.staffId}".`,
      );
    }
  }

  const offer = createStaffOffer({
    id,
    staffId: input.staffId,
    teamId: input.teamId,
    terms: {
      annualSalary: input.annualSalary,
      years: input.years,
    },
    status: "pending",
    createdOn: today,
    updatedOn: today,
  });

  return systemResult({
    ...state,
    world: {
      ...state.world,
      staffMarket: {
        offers: {
          ...state.world.staffMarket.offers,
          [id]: offer,
        },
      },
    },
  });
}

export function negotiateStaffOffer(
  state: GameState,
  offerId: StaffOfferId,
): SystemResult {
  const offer = assertOpenStaffOffer(state, offerId);
  const staff = state.world.staff[offer.staffId]!;
  const interest = evaluateStaffInterest(staff, offer.teamId, state, offer.terms);
  const today = state.world.calendar.currentDate;

  if (!interest.interested || interest.level === "unwilling") {
    const rejected: StaffOffer = {
      ...offer,
      status: "rejected",
      updatedOn: today,
    };
    const events: DomainEvent[] = [
      createDomainEvent({
        type: "StaffOfferRejected",
        occurredOn: today,
        payload: {
          offerId,
          staffId: offer.staffId,
          teamId: offer.teamId,
          level: interest.level,
        },
      }),
    ];
    return systemResult(
      appendSeasonEventLog(withStaffOffer(state, rejected), events),
      events,
    );
  }

  return systemResult(
    withStaffOffer(state, {
      ...offer,
      status: "negotiating",
      updatedOn: today,
    }),
  );
}

export function rejectStaffOffer(
  state: GameState,
  offerId: StaffOfferId,
): SystemResult {
  const offer = assertOpenStaffOffer(state, offerId);
  return systemResult(
    withStaffOffer(state, {
      ...offer,
      status: "rejected",
      updatedOn: state.world.calendar.currentDate,
    }),
  );
}

/**
 * Accept a negotiating (or pending+interested) offer and hire the staff member.
 */
export function acceptStaffOffer(
  state: GameState,
  offerId: StaffOfferId,
): SystemResult {
  const offer = assertOpenStaffOffer(state, offerId);
  const staff = state.world.staff[offer.staffId]!;
  const interest = evaluateStaffInterest(staff, offer.teamId, state, offer.terms);
  if (!interest.interested) {
    return negotiateStaffOffer(state, offerId);
  }

  const hired = hireStaff(state, offer.teamId, offer.staffId, {
    years: offer.terms.years,
    annualSalary: offer.terms.annualSalary,
  });
  let current = hired.state;
  const events = [...hired.events];

  // Find the contract just created
  const year = current.competition.season.year;
  const contract = Object.values(current.business.staffContracts).find(
    (c) =>
      c.staffId === offer.staffId &&
      c.teamId === offer.teamId &&
      c.startYear === year,
  );

  const accepted: StaffOffer = {
    ...offer,
    status: "accepted",
    contractId: contract?.id,
    updatedOn: current.world.calendar.currentDate,
  };
  current = withStaffOffer(current, accepted);

  current = invalidateStaffOffers(current, offer.staffId);
  // Re-apply accepted offer after invalidate
  current = withStaffOffer(current, accepted);

  events.push(
    createDomainEvent({
      type: "StaffOfferAccepted",
      occurredOn: current.world.calendar.currentDate,
      payload: {
        offerId,
        staffId: offer.staffId,
        teamId: offer.teamId,
        contractId: contract?.id,
      },
    }),
  );

  return systemResult(appendSeasonEventLog(current, events), events);
}

function assertOpenStaffOffer(
  state: GameState,
  offerId: StaffOfferId,
): StaffOffer {
  const offer = state.world.staffMarket.offers[offerId];
  if (!offer) {
    throw new Error(`Staff offer "${offerId}" not found.`);
  }
  if (!isOpenStaffOffer(offer.status)) {
    throw new Error(`Staff offer "${offerId}" is not open.`);
  }
  return offer;
}

function withStaffOffer(state: GameState, offer: StaffOffer): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      staffMarket: {
        offers: {
          ...state.world.staffMarket.offers,
          [offer.id]: offer,
        },
      },
    },
  };
}
