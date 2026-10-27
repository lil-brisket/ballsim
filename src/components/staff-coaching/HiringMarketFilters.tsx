"use client";

import { Select } from "@/components/ui/Select";
import { useRouter } from "next/navigation";
import { marketHref } from "@/components/staff-coaching/hiring-market-links";
import { STAFF_ROLE_DISPLAY } from "@/domain/entities/staff-roles";
import type { StaffRole } from "@/domain/entities/staff";

const SORT_LABELS: Record<string, string> = {
  overall: "Best overall",
  potential: "Highest potential",
  salary: "Lowest salary",
};

export function HiringMarketFilters(props: {
  saveId: string;
  roles: Array<{ id: string; count: number }>;
  role: string;
  sort: string;
  sortOptions: string[];
  totalCount: number;
  shownCount: number;
}) {
  const router = useRouter();
  const navigate = (role: string, sort: string) => {
    router.push(marketHref(props.saveId, role, sort));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-muted">
        Role
        <Select
          wrapperClassName="ml-2"
          value={props.role}
          onChange={(event) => navigate(event.target.value, props.sort)}
        >
          <option value="">All roles</option>
          {props.roles.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {STAFF_ROLE_DISPLAY[entry.id as StaffRole] ??
                entry.id.replaceAll("_", " ")}{" "}
              ({entry.count})
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm text-muted">
        Sort
        <Select
          wrapperClassName="ml-2"
          value={props.sort}
          onChange={(event) => navigate(props.role, event.target.value)}
        >
          {props.sortOptions.map((option) => (
            <option key={option} value={option}>
              {SORT_LABELS[option] ?? option}
            </option>
          ))}
        </Select>
      </label>
      <p className="text-sm text-faint">
        {props.shownCount < props.totalCount
          ? `Showing ${props.shownCount} of ${props.totalCount}`
          : `${props.totalCount} available`}
      </p>
    </div>
  );
}
