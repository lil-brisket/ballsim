import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { createSeasonDomainEvent } from "@/systems/season-events/season-event-domain";
import {
  ensureSeasonEventsState,
  withSeasonEvents,
} from "@/systems/season-events/plan-season-events";
import { addCalendarDays } from "@/domain/calendar-date";
import { asPlayerId } from "@/domain/ids";
import type {
  FanVoteCampaign,
  FanVoteCandidate,
  FanVoteCategory,
} from "@/domain/entities/season-events";
import { computeDailyVoteIncrements } from "@/systems/season-events/fan-vote-scoring";

const LEADER_CHANGE_COOLDOWN_KEY = "fan_vote_leader";

/**
 * Fan voting: open → daily ticks → close / finalize.
 * Catch-up: when lastTickDate lags simulatedDate, ticks every missed day.
 */
export function processFanVoting(
  state: GameState,
  rng: Rng,
  simulatedDate: string,
): SystemResult {
  const seasonEvents = ensureSeasonEventsState(state);
  const campaignIds = Object.keys(seasonEvents.fanVoting).sort();
  if (campaignIds.length === 0) {
    return systemResult(state);
  }

  let current = state;
  const events: DomainEvent[] = [];
  let fanVoting = { ...seasonEvents.fanVoting };
  let seasonEventMap = { ...seasonEvents.events };

  for (const campaignId of campaignIds) {
    let campaign = fanVoting[campaignId]!;
    const eventEntry = Object.values(seasonEventMap).find(
      (e) => e.type === "fan_voting" && e.sidecarKey === campaignId,
    );

    // Open
    if (
      campaign.status === "scheduled" &&
      campaign.openDate <= simulatedDate
    ) {
      campaign = { ...campaign, status: "open" };
      if (eventEntry) {
        seasonEventMap = {
          ...seasonEventMap,
          [eventEntry.id]: { ...eventEntry, status: "active" },
        };
      }
      if (seasonEvents.allStar?.campaignId === campaignId) {
        current = withSeasonEvents(current, {
          ...ensureSeasonEventsState(current),
          events: seasonEventMap,
          fanVoting: { ...fanVoting, [campaignId]: campaign },
          allStar: {
            ...seasonEvents.allStar,
            status: "voting",
          },
        });
        fanVoting = {
          ...ensureSeasonEventsState(current).fanVoting,
          [campaignId]: campaign,
        };
        seasonEventMap = ensureSeasonEventsState(current).events;
      }
      events.push(
        createSeasonDomainEvent({
          type: "MidseasonVotingOpened",
          occurredOn: campaign.openDate,
          key: `${campaign.seasonId}_${campaignId}_opened`,
          payload: {
            campaignId,
            openDate: campaign.openDate,
            closeDate: campaign.closeDate,
            title: campaign.title,
          },
        }),
      );
    }

    // Daily ticks (including catch-up)
    if (campaign.status === "open" || campaign.status === "scheduled") {
      // If we jumped past open without opening, open first (handled above).
      if (campaign.status === "open") {
        const tickResult = tickCampaignThroughDate(
          current,
          campaign,
          rng,
          simulatedDate,
        );
        current = tickResult.state;
        campaign = tickResult.campaign;
        events.push(...tickResult.events);
        fanVoting = {
          ...ensureSeasonEventsState(current).fanVoting,
          [campaignId]: campaign,
        };
      }
    }

    // Close
    if (
      campaign.status === "open" &&
      campaign.closeDate <= simulatedDate
    ) {
      // Final tick on close date if needed
      if (
        campaign.lastTickDate == null ||
        campaign.lastTickDate < campaign.closeDate
      ) {
        const tickResult = tickCampaignThroughDate(
          current,
          campaign,
          rng,
          campaign.closeDate,
        );
        current = tickResult.state;
        campaign = tickResult.campaign;
        events.push(...tickResult.events);
      }

      campaign = { ...campaign, status: "finalized" };
      if (eventEntry) {
        seasonEventMap = {
          ...ensureSeasonEventsState(current).events,
          [eventEntry.id]: {
            ...eventEntry,
            status: "completed",
          },
        };
      }
      events.push(
        createSeasonDomainEvent({
          type: "FanVotingClosed",
          occurredOn: campaign.closeDate,
          key: `${campaign.seasonId}_${campaignId}_closed`,
          payload: {
            campaignId,
            closeDate: campaign.closeDate,
            title: campaign.title,
          },
        }),
      );
    }

    fanVoting = { ...fanVoting, [campaignId]: campaign };
  }

  current = withSeasonEvents(current, {
    ...ensureSeasonEventsState(current),
    events: seasonEventMap,
    fanVoting,
  });

  return systemResult(current, events);
}

function tickCampaignThroughDate(
  state: GameState,
  campaign: FanVoteCampaign,
  rng: Rng,
  throughDate: string,
): { state: GameState; campaign: FanVoteCampaign; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  let currentCampaign = campaign;
  let currentState = state;

  const startTick =
    currentCampaign.lastTickDate != null
      ? addCalendarDays(currentCampaign.lastTickDate, 1)
      : currentCampaign.openDate;

  if (startTick > throughDate) {
    return { state: currentState, campaign: currentCampaign, events };
  }

  let cursor = startTick;
  while (cursor <= throughDate && cursor <= currentCampaign.closeDate) {
    const beforeRankings = snapshotRankings(currentCampaign);
    const tick = applyVoteTick(currentState, currentCampaign, rng, cursor);
    currentCampaign = tick.campaign;
    currentState = tick.state;

    const leaderEvents = detectLeaderChanges(
      currentCampaign,
      beforeRankings,
      cursor,
    );
    events.push(...leaderEvents);

    currentCampaign = {
      ...currentCampaign,
      previousRankings: snapshotRankings(currentCampaign),
      lastTickDate: cursor,
    };
    cursor = addCalendarDays(cursor, 1);
  }

  currentState = withSeasonEvents(currentState, {
    ...ensureSeasonEventsState(currentState),
    fanVoting: {
      ...ensureSeasonEventsState(currentState).fanVoting,
      [currentCampaign.id]: currentCampaign,
    },
  });

  return { state: currentState, campaign: currentCampaign, events };
}

function applyVoteTick(
  state: GameState,
  campaign: FanVoteCampaign,
  rng: Rng,
  tickDate: string,
): { state: GameState; campaign: FanVoteCampaign } {
  const categories: Record<string, FanVoteCategory> = {};
  for (const categoryId of Object.keys(campaign.categories).sort()) {
    const category = campaign.categories[categoryId]!;
    const increments = computeDailyVoteIncrements(
      state,
      category,
      rng,
      tickDate,
    );
    const candidates: Record<string, FanVoteCandidate> = {};
    let totalVotes = 0;
    for (const playerId of Object.keys(category.candidates).sort()) {
      const existing = category.candidates[playerId]!;
      const add = increments.get(asPlayerId(playerId)) ?? 0;
      const voteTotal = existing.voteTotal + add;
      totalVotes += voteTotal;
      candidates[playerId] = {
        ...existing,
        voteTotal,
        previousRank:
          campaign.previousRankings[categoryId]?.[playerId] ?? null,
      };
    }

    const ranked = Object.values(candidates).sort((a, b) => {
      if (b.voteTotal !== a.voteTotal) return b.voteTotal - a.voteTotal;
      return a.playerId.localeCompare(b.playerId);
    });
    ranked.forEach((candidate, index) => {
      const rank = index + 1;
      const voteShare =
        totalVotes > 0 ? candidate.voteTotal / totalVotes : 0;
      candidates[candidate.playerId] = {
        ...candidate,
        rank,
        voteShare,
        previousRank:
          campaign.previousRankings[categoryId]?.[candidate.playerId] ?? null,
      };
    });

    categories[categoryId] = { ...category, candidates };
  }

  return {
    state,
    campaign: { ...campaign, categories },
  };
}

function snapshotRankings(
  campaign: FanVoteCampaign,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const categoryId of Object.keys(campaign.categories)) {
    const ranks: Record<string, number> = {};
    for (const [playerId, candidate] of Object.entries(
      campaign.categories[categoryId]!.candidates,
    )) {
      if (candidate.rank > 0) {
        ranks[playerId] = candidate.rank;
      }
    }
    result[categoryId] = ranks;
  }
  return result;
}

function detectLeaderChanges(
  campaign: FanVoteCampaign,
  previousRankings: Record<string, Record<string, number>>,
  occurredOn: string,
): DomainEvent[] {
  const events: DomainEvent[] = [];
  for (const categoryId of Object.keys(campaign.categories).sort()) {
    const category = campaign.categories[categoryId]!;
    const prev = previousRankings[categoryId] ?? {};
    const top = Object.values(category.candidates)
      .filter((c) => c.rank > 0)
      .sort((a, b) => a.rank - b.rank);

    const leader = top[0];
    if (!leader) continue;

    const prevLeaderId = Object.entries(prev).find(([, rank]) => rank === 1)?.[0];
    if (prevLeaderId != null && prevLeaderId !== leader.playerId) {
      events.push(
        createSeasonDomainEvent({
          type: "FanVoteLeaderChanged",
          occurredOn,
          key: `${campaign.seasonId}_${campaign.id}_${categoryId}_${occurredOn}_leader`,
          payload: {
            campaignId: campaign.id,
            categoryId,
            categoryLabel: category.label,
            playerId: leader.playerId,
            previousPlayerId: prevLeaderId,
            voteTotal: leader.voteTotal,
            rank: 1,
            transition: LEADER_CHANGE_COOLDOWN_KEY,
          },
        }),
      );
    }

    // New entrant into top 5
    for (const candidate of top.slice(0, 5)) {
      const prevRank = prev[candidate.playerId];
      if (prevRank == null || prevRank > 5) {
        if (candidate.rank <= 5 && (prevRank == null || prevRank > 5)) {
          // Only emit when there was a prior ranking snapshot (skip first tick)
          if (Object.keys(prev).length > 0) {
            events.push(
              createSeasonDomainEvent({
                type: "FanVoteLeaderChanged",
                occurredOn,
                key: `${campaign.seasonId}_${campaign.id}_${categoryId}_${occurredOn}_enter5_${candidate.playerId}`,
                payload: {
                  campaignId: campaign.id,
                  categoryId,
                  categoryLabel: category.label,
                  playerId: candidate.playerId,
                  voteTotal: candidate.voteTotal,
                  rank: candidate.rank,
                  previousRank: prevRank ?? null,
                  transition: "entered_top_5",
                },
              }),
            );
          }
        }
      }
    }
  }
  return events;
}
