export function marketHref(
  saveId: string,
  role?: string,
  sort?: string,
): string {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (sort && sort !== "overall") params.set("sort", sort);
  const query = params.toString();
  return `/dashboard/${saveId}/staff-coaching/hiring-market${
    query ? `?${query}` : ""
  }`;
}
