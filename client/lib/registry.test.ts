import {
  PERMISSION_PATTERN,
  registry,
  visibleEntries,
  type RegistryEntry,
} from './registry';

describe('registry', () => {
  it.each(registry.map((entry) => [entry.name, entry]))(
    '%s has an absolute path and an <app>.<resource>.<action> permission',
    (_name, entry) => {
      expect(entry.path).toMatch(/^\/[a-z0-9-/]*$/);
      expect(entry.requiredPermission).toMatch(PERMISSION_PATTERN);
    },
  );

  it('has unique names and paths', () => {
    expect(new Set(registry.map((e) => e.path)).size).toBe(registry.length);
    expect(new Set(registry.map((e) => e.name)).size).toBe(registry.length);
  });

  it('lists the audit log for platform.audit.read only', () => {
    expect(visibleEntries(['platform.audit.read']).map((e) => e.path)).toEqual([
      '/audit',
    ]);
    expect(visibleEntries(['platform.session.read'])).toEqual([]);
    expect(visibleEntries([])).toEqual([]);
  });

  it('filters arbitrary entries by permission', () => {
    const entries: RegistryEntry[] = [
      { name: 'A', path: '/a', requiredPermission: 'a.thing.read' },
      { name: 'B', path: '/b', requiredPermission: 'b.thing.read' },
    ];
    expect(visibleEntries(['b.thing.read'], entries)).toEqual([entries[1]]);
  });
});
