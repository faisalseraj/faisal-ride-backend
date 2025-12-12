export const percentage = (obtain: number, total: number) => {
  if (obtain === 0 && total === 0) return '0%';
  if (obtain === 0 && total !== 0) return '100%';
  if (obtain > total) return '100%';
  return `${((obtain / total) * 100).toFixed(2)}%`;
};
