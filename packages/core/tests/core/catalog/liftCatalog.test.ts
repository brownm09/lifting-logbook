import { DEFAULT_SLOT_MAP, LIFT_CATALOG, resolveLift } from "@src/core";

describe("LIFT_CATALOG", () => {
  it("contains at least 20 lifts", () => {
    expect(LIFT_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it("all lifts have a non-empty id, name, and valid classification", () => {
    for (const lift of LIFT_CATALOG) {
      expect(lift.id).toBeTruthy();
      expect(lift.name).toBeTruthy();
      expect(['compound', 'accessory']).toContain(lift.classification);
    }
  });

  it("all movementTags are valid values", () => {
    const validTags = new Set(['push', 'pull', 'vertical', 'horizontal', 'hinge', 'carry']);
    for (const lift of LIFT_CATALOG) {
      for (const tag of lift.movementTags) {
        expect(validTags.has(tag)).toBe(true);
      }
    }
  });

  it("all lift ids are unique", () => {
    const ids = LIFT_CATALOG.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("classification and tags — spot checks", () => {
    it("deadlift is compound with hinge tag", () => {
      const lift = LIFT_CATALOG.find((l) => l.id === 'deadlift')!;
      expect(lift.classification).toBe('compound');
      expect(lift.movementTags).toContain('hinge');
    });

    it("bench-press is compound with push and horizontal tags", () => {
      const lift = LIFT_CATALOG.find((l) => l.id === 'bench-press')!;
      expect(lift.classification).toBe('compound');
      expect(lift.movementTags).toContain('push');
      expect(lift.movementTags).toContain('horizontal');
    });

    it("overhead-press is compound with push and vertical tags", () => {
      const lift = LIFT_CATALOG.find((l) => l.id === 'overhead-press')!;
      expect(lift.classification).toBe('compound');
      expect(lift.movementTags).toContain('push');
      expect(lift.movementTags).toContain('vertical');
    });

    it("chin-up is compound with pull and vertical tags", () => {
      const lift = LIFT_CATALOG.find((l) => l.id === 'chin-up')!;
      expect(lift.classification).toBe('compound');
      expect(lift.movementTags).toContain('pull');
      expect(lift.movementTags).toContain('vertical');
    });

    it("barbell-row is compound with pull and horizontal tags", () => {
      const lift = LIFT_CATALOG.find((l) => l.id === 'barbell-row')!;
      expect(lift.classification).toBe('compound');
      expect(lift.movementTags).toContain('pull');
      expect(lift.movementTags).toContain('horizontal');
    });

    it("cable-curl is accessory with pull tag", () => {
      const lift = LIFT_CATALOG.find((l) => l.id === 'cable-curl')!;
      expect(lift.classification).toBe('accessory');
      expect(lift.movementTags).toContain('pull');
    });

    it("farmers-carry is compound with carry tag", () => {
      const lift = LIFT_CATALOG.find((l) => l.id === 'farmers-carry')!;
      expect(lift.classification).toBe('compound');
      expect(lift.movementTags).toContain('carry');
    });
  });

  describe("covers major movement patterns", () => {
    it("has at least one squat-pattern lift", () => {
      const squatLifts = LIFT_CATALOG.filter((l) =>
        l.id.includes('squat') || l.id.includes('goblet'),
      );
      expect(squatLifts.length).toBeGreaterThanOrEqual(1);
    });

    it("has at least one hinge-pattern lift", () => {
      expect(LIFT_CATALOG.some((l) => l.movementTags.includes('hinge'))).toBe(true);
    });

    it("has at least one carry-pattern lift", () => {
      expect(LIFT_CATALOG.some((l) => l.movementTags.includes('carry'))).toBe(true);
    });

    it("has at least one vertical push lift", () => {
      expect(
        LIFT_CATALOG.some(
          (l) => l.movementTags.includes('push') && l.movementTags.includes('vertical'),
        ),
      ).toBe(true);
    });

    it("has at least one vertical pull lift", () => {
      expect(
        LIFT_CATALOG.some(
          (l) => l.movementTags.includes('pull') && l.movementTags.includes('vertical'),
        ),
      ).toBe(true);
    });

    it("has at least one horizontal push lift", () => {
      expect(
        LIFT_CATALOG.some(
          (l) => l.movementTags.includes('push') && l.movementTags.includes('horizontal'),
        ),
      ).toBe(true);
    });

    it("has at least one horizontal pull lift", () => {
      expect(
        LIFT_CATALOG.some(
          (l) => l.movementTags.includes('pull') && l.movementTags.includes('horizontal'),
        ),
      ).toBe(true);
    });
  });
});

describe("resolveLift", () => {
  it("resolves a canonical slot name to the correct catalog lift", () => {
    const lift = resolveLift('Deadlift', DEFAULT_SLOT_MAP, LIFT_CATALOG);
    expect(lift.id).toBe('deadlift');
    expect(lift.name).toBe('Deadlift');
  });

  it("resolves an RPT-abbreviated slot name to the correct catalog lift", () => {
    const lift = resolveLift('Bench P.', DEFAULT_SLOT_MAP, LIFT_CATALOG);
    expect(lift.id).toBe('bench-press');
    expect(lift.name).toBe('Bench Press');
  });

  it("resolves all RPT CSV slot names without error", () => {
    const rptSlots = [
      'Bench P.', 'BB Row', 'Calf Raise', 'C. Lat Raise', 'OH Press-HV',
      'Squat', 'Chin-up', 'Dip', 'Upright Row',
      'Deadlift', 'OH Press', 'CBL Curls', 'Face Pulls',
    ];
    for (const slot of rptSlots) {
      expect(() => resolveLift(slot, DEFAULT_SLOT_MAP, LIFT_CATALOG)).not.toThrow();
    }
  });

  it("resolves all 5/3/1 canonical slot names without error", () => {
    const fiveThreeOneSlots = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press'];
    for (const slot of fiveThreeOneSlots) {
      expect(() => resolveLift(slot, DEFAULT_SLOT_MAP, LIFT_CATALOG)).not.toThrow();
    }
  });

  it("throws when slot name is not in the slot map", () => {
    expect(() => resolveLift('Unknown Exercise', DEFAULT_SLOT_MAP, LIFT_CATALOG)).toThrow(
      /Unknown exercise slot/,
    );
  });

  it("throws when resolved lift id is not in the catalog", () => {
    const badMap: Record<string, string> = { 'Squat': 'nonexistent-id' };
    expect(() => resolveLift('Squat', badMap, LIFT_CATALOG)).toThrow(
      /not found in catalog/,
    );
  });
});
