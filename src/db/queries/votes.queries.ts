import { and, eq, sql } from "drizzle-orm";

import { db } from "../index.js";
import { postVotes } from "../schema.js";
import type { VoteSummary, VoteType } from "../../modules/votes/votes.types.js";

export const votesQueries = {
  async upsertVote(
    postId: string,
    userId: string,
    voteType: VoteType,
  ): Promise<void> {
    if (voteType === 0) {
      await db
        .delete(postVotes)
        .where(
          and(eq(postVotes.postId, postId), eq(postVotes.userId, userId)),
        );
      return;
    }

    await db
      .insert(postVotes)
      .values({
        postId,
        userId,
        voteType,
      })
      .onConflictDoUpdate({
        target: [postVotes.postId, postVotes.userId],
        set: {
          voteType,
          updatedAt: new Date(),
        },
      });
  },

  async getVoteSummary(
    postId: string,
    currentUserId?: string,
  ): Promise<VoteSummary> {
    const [stats] = await db
      .select({
        score: sql<number>`COALESCE(SUM(${postVotes.voteType}), 0)`,
        upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${postVotes.voteType} = 1 THEN 1 ELSE 0 END), 0)`,
        downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${postVotes.voteType} = -1 THEN 1 ELSE 0 END), 0)`,
      })
      .from(postVotes)
      .where(eq(postVotes.postId, postId));

    let userVote: 1 | -1 | null = null;
    if (currentUserId) {
      const [userVoteRow] = await db
        .select({ voteType: postVotes.voteType })
        .from(postVotes)
        .where(
          and(eq(postVotes.postId, postId), eq(postVotes.userId, currentUserId)),
        )
        .limit(1);

      if (userVoteRow) {
        userVote = userVoteRow.voteType as 1 | -1;
      }
    }

    return {
      score: Number(stats?.score ?? 0),
      upvotes: Number(stats?.upvotes ?? 0),
      downvotes: Number(stats?.downvotes ?? 0),
      userVote,
    };
  },
};

export const voteQueries = votesQueries;
