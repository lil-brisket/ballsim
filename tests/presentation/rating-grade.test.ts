import { describe, expect, it } from "vitest";
import {
  GRADES,
  GRADE_MINIMUMS,
  formatRating,
  formatRatingRange,
  gradeBand,
  gradeFor,
} from "@/presentation/rating-grade";
import { ratingTier } from "@/presentation/rating-tier";

describe("gradeFor", () => {
  it.each(GRADE_MINIMUMS)("%s starts at %i", (grade, minimum) => {
    expect(gradeFor(minimum)).toBe(grade);
    expect(gradeFor(minimum + 1)).toBe(grade);
  });

  it("drops to the next letter just below every cut-off", () => {
    GRADE_MINIMUMS.forEach(([grade, minimum], index) => {
      const next = GRADE_MINIMUMS[index + 1]?.[0] ?? "F";
      expect(gradeFor(minimum - 1)).toBe(next);
      expect(next).not.toBe(grade);
    });
  });

  it("gives F below the lowest cut-off and A+ at the top", () => {
    expect(gradeFor(44)).toBe("F");
    expect(gradeFor(0)).toBe("F");
    expect(gradeFor(99)).toBe("A+");
  });

  it("is monotonic over the whole 0-99 range", () => {
    let last: number = GRADES.length;
    for (let rating = 0; rating <= 99; rating += 1) {
      const rank = GRADES.indexOf(gradeFor(rating));
      expect(rank).toBeLessThanOrEqual(last);
      last = rank;
    }
  });
});

describe("gradeBand", () => {
  it("never colours a letter above the tier its lower bound reaches", () => {
    const order = ["bench", "role", "starter", "star", "elite", "legend"];
    for (const [grade, minimum] of GRADE_MINIMUMS) {
      const tier = ratingTier(minimum).id;
      expect(order.indexOf(gradeBand(grade))).toBeGreaterThanOrEqual(
        order.indexOf(tier) - 1,
      );
      expect(order.indexOf(gradeBand(grade))).toBeLessThanOrEqual(
        order.indexOf(tier),
      );
    }
  });

  it("uses one band per letter, bench for everything below C-", () => {
    expect(gradeBand("A+")).toBe("elite");
    expect(gradeBand("B")).toBe("starter");
    expect(gradeBand("C")).toBe("role");
    expect(gradeBand("D+")).toBe("bench");
    expect(gradeBand("F")).toBe("bench");
  });
});

describe("formatRating", () => {
  it("shows the letter and speaks the number in grades mode", () => {
    expect(formatRating(81, "grades")).toEqual({
      text: "B+",
      label: "B plus, 81",
      grade: "B+",
      band: "star",
    });
    expect(formatRating(84, "grades").label).toBe("A minus, 84");
    expect(formatRating(76, "grades").label).toBe("B, 76");
  });

  it("shows the number in ratings mode with the same colour band", () => {
    const ratings = formatRating(81, "ratings");
    expect(ratings.text).toBe("81");
    expect(ratings.label).toBe("81");
    expect(ratings.band).toBe(formatRating(81, "grades").band);
  });

  it("rounds before grading", () => {
    expect(formatRating(79.6, "grades").text).toBe("B+");
    expect(formatRating(79.4, "ratings").text).toBe("79");
  });
});

describe("formatRatingRange", () => {
  it("shows the low grade first, joined by an en dash", () => {
    const range = formatRatingRange({ min: 80, max: 84 }, "grades");
    expect(range.text).toBe("B+–A-");
    expect(range.label).toBe("B plus to A minus, 80 to 84");
    expect(range.lowGrade).toBe("B+");
    expect(range.highGrade).toBe("A-");
  });

  it("collapses to one letter when both ends share a grade", () => {
    const range = formatRatingRange({ min: 76, max: 79 }, "grades");
    expect(range.text).toBe("B");
    expect(range.label).toBe("B, 76 to 79");
  });

  it("shows numbers in ratings mode, one number when min equals max", () => {
    const wide = formatRatingRange({ min: 74, max: 86 }, "ratings");
    expect(wide.text).toBe("74–86");
    expect(wide.label).toBe("74 to 86");
    const point = formatRatingRange({ min: 80, max: 80 }, "ratings");
    expect(point.text).toBe("80");
    expect(point.label).toBe("80");
    expect(formatRatingRange({ min: 80, max: 80 }, "grades").label).toBe(
      "B plus, 80",
    );
  });

  it("colours by the midpoint's grade in both modes", () => {
    // 64..96 spans C to A+, midpoint 80 is B+ (star).
    const grades = formatRatingRange({ min: 64, max: 96 }, "grades");
    const ratings = formatRatingRange({ min: 64, max: 96 }, "ratings");
    expect(grades.band).toBe(gradeBand(gradeFor(80)));
    expect(ratings.band).toBe(grades.band);
  });

  it("tolerates a reversed range and rounds the ends", () => {
    expect(formatRatingRange({ min: 85.6, max: 73.6 }, "ratings").text).toBe(
      "74–86",
    );
  });
});
