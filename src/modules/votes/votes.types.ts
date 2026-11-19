export type VoteType = 1 | -1 | 0;

export type VoteInput = {
  voteType: VoteType;
};

export type VoteSummary = {
  score: number;
  upvotes: number;
  downvotes: number;
  userVote: 1 | -1 | null;
};
