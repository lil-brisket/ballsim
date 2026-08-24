import type { DetectorCandidate } from "@/systems/narrative/types";
import type { NarrativeSeverity } from "@/domain/entities/narrative-situation";
import type { Rng } from "@/domain/rng";

export type RenderedNarrative = {
  title: string;
  summary: string;
  body: string;
  severity: NarrativeSeverity;
};

function num(ctx: Record<string, number | boolean | string>, key: string): number {
  const value = ctx[key];
  return typeof value === "number" ? value : Number(value) || 0;
}

function bool(ctx: Record<string, number | boolean | string>, key: string): boolean {
  return ctx[key] === true;
}

function str(ctx: Record<string, number | boolean | string>, key: string): string {
  const value = ctx[key];
  return typeof value === "string" ? value : String(value ?? "");
}

function pick(
  rng: Rng | undefined,
  options: readonly RenderedNarrative[],
): RenderedNarrative {
  if (options.length === 0) {
    throw new Error("Narrative template options must not be empty.");
  }
  if (options.length === 1 || !rng) {
    return options[0]!;
  }
  return rng.pick([...options]);
}

/** Presentation-only — no thresholds. */
export function renderNarrative(
  candidate: DetectorCandidate,
  rng?: Rng,
): RenderedNarrative {
  const ctx = candidate.templateContext;
  const severity = candidate.severity;

  switch (candidate.detectorKey) {
    case "attendance_decline":
    case "fan_demand":
      return renderAttendance(ctx, severity, rng, candidate.resolve === true);
    case "fan_price_friction":
      return {
        title: "Ticket-price friction",
        summary:
          "Supporters are pushing back on ticket prices as attendance and sentiment soften.",
        body: `Ticket prices sit ${num(ctx, "vsLeagueTicketPricePct")}% above the league average while attendance is down ${num(ctx, "attendanceDownPct")}% and fan sentiment has shifted ${num(ctx, "sentimentChange")}.`,
        severity,
      };
    case "sponsor_visibility_concern":
      if (candidate.resolve) {
        return {
          title: "Sponsor visibility concern eased",
          summary: "Commercial partners are no longer escalating visibility worries.",
          body: "Attendance and demand signals have recovered enough that sponsor pressure is no longer active.",
          severity: "informational",
        };
      }
      return {
        title: "Sponsors question visibility",
        summary:
          "Partners are asking whether the franchise still delivers the audience they paid for.",
        body: `Attendance pressure has persisted for ${num(ctx, "daysSinceAttendanceAlert")} days. Sponsor risk sits near ${Math.round(num(ctx, "sponsorRisk") * 100)}% with media attention at ${num(ctx, "mediaAttention")}. Ignoring this may invite harder public criticism.`,
        severity,
      };
    case "media_ownership_pressure":
      if (candidate.resolve) {
        return {
          title: "Media ownership pressure eased",
          summary: "Coverage of ownership has cooled as commercial conditions improved.",
          body: "Local media is no longer amplifying an unresolved attendance and sponsor spiral.",
          severity: "informational",
        };
      }
      return {
        title: "Local media turns on ownership",
        summary:
          "Coverage is framing ownership as slow to respond to a developing commercial crisis.",
        body: `Sponsor concern has been open for ${num(ctx, "daysSinceSponsorAlert")} days. Fan sentiment is ${num(ctx, "fanSentiment")} and media attention is ${num(ctx, "mediaAttention")}. The story is no longer just soft attendance — it is about leadership.`,
        severity,
      };
    case "losing_slide":
      if (candidate.resolve) {
        return {
          title: "Losing slide eased",
          summary: "The recent losing streak has ended.",
          body: "On-court results have stabilized enough that the losing-slide concern is no longer active.",
          severity: "informational",
        };
      }
      return {
        title: "Losing slide weighing on demand",
        summary: `A ${num(ctx, "streakLength")}-game losing streak is beginning to show up in the gate.`,
        body: `The team has dropped ${num(ctx, "streakLength")} straight games. Attendance is down ${num(ctx, "attendanceDownPct")}% over the recent stretch, and the combination is becoming noticeable around the franchise.`,
        severity,
      };
    case "playoff_momentum":
      return {
        title: "Playoff momentum building",
        summary:
          "Strong results are lifting attendance and attention around the franchise.",
        body: `A ${num(ctx, "streakLength")}-game winning streak${bool(ctx, "playoffQualified") ? " and playoff qualification" : ""} are changing the atmosphere. Fill rates sit ${num(ctx, "vsLeagueFillPct")}% relative to the league average.`,
        severity,
      };
    case "financial_pressure":
      if (candidate.resolve) {
        return {
          title: "Financial pressure easing",
          summary: `Financial health has returned to ${str(ctx, "healthBand")}.`,
          body: "Cash and operating trends no longer meet the threshold for an active financial-pressure situation.",
          severity: "informational",
        };
      }
      return {
        title: "Financial pressure",
        summary: `Franchise financial health is ${str(ctx, "healthBand")}.`,
        body: `Cash stands at $${Math.round(num(ctx, "cash")).toLocaleString()} with runway near ${num(ctx, "runwayWeeks")} weeks. Ticket and merchandise revenue changed ${num(ctx, "ticketMerchChangePct")}% versus last month.`,
        severity,
      };
    case "expectation_gap":
      if (bool(ctx, "beating")) {
        return pick(rng, [
          {
            title: "Outperforming expectations",
            summary:
              "The franchise is ahead of its competitive expectations this season.",
            body: `With a ${num(ctx, "wins")}-${num(ctx, "losses")} record, the team is outperforming its ownership targets${bool(ctx, "attendanceMoved") || bool(ctx, "mediaMoved") ? ", and attendance or media attention is beginning to reflect that success" : ""}.`,
            severity,
          },
        ]);
      }
      return {
        title: "Below expectations",
        summary:
          "Results are materially short of ownership expectations.",
        body: `At ${num(ctx, "wins")}-${num(ctx, "losses")}, the franchise is underperforming its targets by roughly ${Math.abs(num(ctx, "gapPct"))}%${bool(ctx, "attendanceMoved") ? ", and gate demand is also shifting" : ""}.`,
        severity,
      };
    case "facility_staff_concern":
      if (candidate.resolve) {
        return {
          title: "Facility gap closed",
          summary:
            "Facility investment is no longer lagging comparable teams.",
          body: "The earlier facility concern has cleared based on league-relative facility levels.",
          severity: "informational",
        };
      }
      return {
        title: "Facilities lagging the league",
        summary:
          "Facility investment is behind comparable teams while on-court or development results are soft.",
        body: `Average facility level is ${num(ctx, "facilityMean")} versus a league median of ${num(ctx, "leagueMedianFacility")}${bool(ctx, "developmentWeak") ? ". Player development has also weakened recently" : ""}${bool(ctx, "losing") ? ", and results have been poor" : ""}.`,
        severity,
      };
    case "sponsor_opportunity":
      return {
        title: "Sponsor interest rising",
        summary:
          "Reputation and visibility are strong enough to support a more lucrative commercial deal.",
        body: `With reputation at ${num(ctx, "reputation")} and media attention at ${num(ctx, "mediaAttention")}, the sponsorship climate (${num(ctx, "sponsorshipClimate")}) favors pursuing an extension or new partner.`,
        severity,
      };
    case "objective_progress":
      if (bool(ctx, "failing")) {
        return {
          title: "Ownership objective at risk",
          summary: str(ctx, "description"),
          body: `Progress is ${num(ctx, "progress")} against a target of ${num(ctx, "target")}. The gap is large enough to put the mandate at risk.`,
          severity,
        };
      }
      return {
        title: "Ownership objective within reach",
        summary: str(ctx, "description"),
        body: `Progress is ${num(ctx, "progress")} toward ${num(ctx, "target")}. Another strong stretch would put the objective within reach.`,
        severity,
      };
    case "franchise_value_move":
      return {
        title: bool(ctx, "rising")
          ? "Franchise value rising"
          : "Franchise value softening",
        summary: `Derived franchise value moved ${num(ctx, "franchiseValueChangePct")}% versus last month.`,
        body: `The valuation shift coincides with a ${num(ctx, "winPct")} win rate and a ${num(ctx, "ticketMerchChangePct")}% change in ticket and merchandise revenue — narrative is explaining the valuation system, not replacing it.`,
        severity,
      };
    case "rival_strength_change":
      return {
        title: "Rival roster strengthened",
        summary:
          "A conference rival added a high-impact player, shifting the competitive landscape.",
        body: `A rival franchise (${str(ctx, "rivalTeamId")}) completed a ${str(ctx, "eventType")} involving a ${num(ctx, "playerOverall")} overall player.`,
        severity,
      };
    case "facility_completed":
      return {
        title: "Facility upgrade complete",
        summary: `${str(ctx, "facilityCategory")} facilities reached level ${num(ctx, "facilityLevel")}.`,
        body: `The completed ${str(ctx, "facilityCategory")} upgrade (level ${num(ctx, "facilityLevel")}) is already becoming a talking point around the organization as a tangible ownership investment.`,
        severity,
      };
    case "sponsor_expiry":
      return {
        title: "Sponsorship expired",
        summary: "A commercial partnership has reached the end of its term.",
        body: "An existing sponsorship has expired. Replacing the deal would restore a recurring revenue line; deferring leaves that capacity open.",
        severity,
      };
    case "league_economy_shift":
      return {
        title: bool(ctx, "rising")
          ? "League economy strengthening"
          : "League economy softening",
        summary: `League popularity is ${num(ctx, "leaguePopularity")} with broadcast value at ${num(ctx, "leagueBroadcast")}.`,
        body: bool(ctx, "rising")
          ? "League-wide popularity and broadcast conditions are elevated, supporting distributions across the league."
          : "League-wide popularity or broadcast conditions are soft, which can pressure franchise revenues league-wide.",
        severity,
      };
    case "relocation_pressure":
      return {
        title: bool(ctx, "tenureBlocked")
          ? "Relocation economics — tenure holds the franchise"
          : "Relocation becoming a strategic question",
        summary:
          str(ctx, "primaryDriver") ||
          "Market and franchise conditions are making relocation worth discussing.",
        body: `Assessment status: ${str(ctx, "status")}. Basketball health is ${str(ctx, "basketballHealth")}; business health is ${str(ctx, "businessHealth")}; market size is ${num(ctx, "marketSize")}. Stay path: ${str(ctx, "stayAdvantage") || "invest locally or wait"}. Relocation remains an owner decision — never automatic.`,
        severity,
      };
    case "expansion_discussion":
      return {
        title:
          str(ctx, "status") === "opportunity"
            ? "Expansion opportunity emerging"
            : "Expansion discussion incomplete",
        summary:
          str(ctx, "summary") ||
          "League gates for expansion are being reassessed.",
        body: `League readiness ${bool(ctx, "leagueReady") ? "open" : "closed"}, markets ${bool(ctx, "marketsOpen") ? "open" : "closed"}, capacity ${bool(ctx, "capacityOpen") ? "open" : "closed"}. ${num(ctx, "marketCount")} candidate market(s) under review.`,
        severity,
      };
    default:
      return {
        title: "Franchise development",
        summary: "A meaningful franchise development was detected.",
        body: "See evidence for underlying simulation facts.",
        severity,
      };
  }
}

function renderAttendance(
  ctx: Record<string, number | boolean | string>,
  severity: NarrativeSeverity,
  rng: Rng | undefined,
  resolve: boolean,
): RenderedNarrative {
  if (resolve) {
    return {
      title: "Attendance recovering",
      summary: "Attendance has begun to recover after the recent decline.",
      body: `Fill rates have risen for ${num(ctx, "consecutiveRisingMonths")} month(s), closing the earlier attendance-decline situation.`,
      severity: "informational",
    };
  }

  const consecutive = num(ctx, "consecutiveDecliningMonths");
  const options: RenderedNarrative[] = [];

  if (consecutive >= 3 && bool(ctx, "belowAttendanceObjective")) {
    options.push({
      title: "Attendance materially below target",
      summary: `Attendance has declined for ${consecutive} consecutive months and remains short of the ownership target.`,
      body: `Fill rates are down ${num(ctx, "attendanceDownPct")}% versus last month, now ${consecutive} months in decline. Fan sentiment shifted ${num(ctx, "sentimentChange")}, and the franchise sits ${num(ctx, "vsLeagueAttendancePct")}% relative to league fill.`,
      severity,
    });
  } else if (consecutive >= 3) {
    options.push({
      title: "Attendance decline deepening",
      summary: `Attendance has now declined for ${consecutive} consecutive months.`,
      body: `The gate is down ${num(ctx, "attendanceDownPct")}% month over month. Relative to the league, fill is ${num(ctx, "vsLeagueAttendancePct")}%. Sentiment changed ${num(ctx, "sentimentChange")}.`,
      severity,
    });
  } else {
    options.push({
      title: "Attendance beginning to soften",
      summary: `Attendance has fallen for ${consecutive} consecutive months.`,
      body: `Fill rates declined ${num(ctx, "attendanceDownPct")}% versus the prior month (${consecutive} months running). League-relative fill is ${num(ctx, "vsLeagueAttendancePct")}%.`,
      severity,
    });
  }

  if (bool(ctx, "aggregated")) {
    options.push({
      title: "Fan demand is weakening",
      summary:
        "Results, pricing, and attendance are combining into a broader demand problem.",
      body: `Attendance is down ${num(ctx, "attendanceDownPct")}% with ${consecutive} months of decline. Ticket pricing sits ${num(ctx, "vsLeagueTicketPricePct")}% versus the league, sentiment shifted ${num(ctx, "sentimentChange")}, and recent results have not supported the gate.`,
      severity,
    });
  }

  return pick(rng, options);
}
