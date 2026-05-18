/** Project limits (own projects created by the user). */
export const MAX_PROJECTS_BASIC = 2;
export const MAX_PROJECTS_PREMIUM = 50;

/** Idea Hub list fetch size (premium effectively unlimited). */
export const MAX_IDEAS_LIST_BASIC = 200;
export const MAX_IDEAS_LIST_PREMIUM = 10_000;

export function getMaxProjectsForPlan(plan) {
  return plan === "premium" ? MAX_PROJECTS_PREMIUM : MAX_PROJECTS_BASIC;
}

export function getIdeaHubListLimit(plan) {
  return plan === "premium" ? MAX_IDEAS_LIST_PREMIUM : MAX_IDEAS_LIST_BASIC;
}

/** Premium and admins: no cap on Idea Hub entries. */
export function hasUnlimitedIdeaHub(plan, isAdmin = false) {
  return isAdmin || plan === "premium";
}

export function canCreateProject(plan, ownedProjectCount, isAdmin = false) {
  if (isAdmin) return true;
  return ownedProjectCount < getMaxProjectsForPlan(plan);
}
