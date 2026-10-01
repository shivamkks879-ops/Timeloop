// Web stub for rewarded ads — never shows an ad on web.
export type RewardKind = "continue" | "hint";
export function showRewarded(
  _kind: RewardKind,
  _onReward: () => void,
  onUnavailable: () => void,
) {
  onUnavailable();
}
