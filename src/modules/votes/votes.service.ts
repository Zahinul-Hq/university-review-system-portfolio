import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../api/errors.js";
import { postsQueries } from "../../db/queries/posts.queries.js";
import { votesQueries } from "../../db/queries/votes.queries.js";
import type { VoteInput, VoteSummary } from "./votes.types.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class VotesService {
  async votePost(
    postId: string,
    currentUserId: string,
    input: VoteInput,
  ): Promise<VoteSummary> {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestError("Invalid post ID format");
    }

    const voteType = input.voteType;
    if (voteType !== 1 && voteType !== -1 && voteType !== 0) {
      throw new BadRequestError("Vote type must be 1, -1, or 0");
    }

    const affiliation = await postsQueries.findUserAffiliation(currentUserId);
    if (!affiliation) {
      throw new NotFoundError("User account not found");
    }
    if (!affiliation.emailVerifiedAt) {
      throw new ForbiddenError("Verify your signup email before voting");
    }

    const post = await postsQueries.findPostAuthor(postId);
    if (!post || post.status !== "published") {
      throw new NotFoundError("Review not found");
    }

    if (post.userId === currentUserId) {
      throw new BadRequestError("You cannot vote on your own review");
    }

    await votesQueries.upsertVote(postId, currentUserId, voteType);
    return votesQueries.getVoteSummary(postId, currentUserId);
  }

  async getVoteSummary(
    postId: string,
    currentUserId?: string,
  ): Promise<VoteSummary> {
    if (!UUID_REGEX.test(postId)) {
      throw new BadRequestError("Invalid post ID format");
    }
    return votesQueries.getVoteSummary(postId, currentUserId);
  }
}

export const votesService = new VotesService();
