export { computeRelevanceScore } from "@/systems/media-hub/relevance";
export type { RelevanceOptions } from "@/systems/media-hub/relevance";

export {
  generateHeadline,
  relatedIdsFromEvent,
} from "@/systems/media-hub/generate-headline";
export type { GeneratedHeadline } from "@/systems/media-hub/generate-headline";

export { generateSocialPosts } from "@/systems/media-hub/generate-social-posts";
export type { GenerateSocialPostsInput } from "@/systems/media-hub/generate-social-posts";

export { processMediaFromEvents } from "@/systems/media-hub/process-media-from-events";
export type {
  ProcessMediaOptions,
  ProcessMediaResult,
} from "@/systems/media-hub/process-media-from-events";

export { processDerivedProjections } from "@/systems/media-hub/process-derived-projections";
