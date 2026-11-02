export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || name.slice(0, 2).toUpperCase();
