export const BOND_PAGE_SIZE = 24;
export function bondPage(bonds, page = 1, query = '') {
  const q = query.trim().toLocaleLowerCase();
  const matches = bonds.filter(bond => !q || [bond.id, bond.name, bond.nickname, ...(bond.qqList || []), ...(bond.playerNames || []), ...(bond.mcNames || [])].some(value => String(value || '').toLocaleLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(matches.length / BOND_PAGE_SIZE));
  const current = Math.max(1, Math.min(pages, Number(page) || 1));
  const offset = (current - 1) * BOND_PAGE_SIZE;
  return { items: matches.slice(offset, offset + BOND_PAGE_SIZE), total: matches.length, pages, current, offset };
}
