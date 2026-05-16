import prisma from '../db';

const CYR: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};

export function toSlug(name: string): string {
  return name.toLowerCase()
    .split('').map(c => CYR[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function generateUniqueSlug(name: string, profileId: number): Promise<string> {
  const base = toSlug(name) || `expert-${profileId}`;
  const taken = await prisma.trainerProfile.findUnique({ where: { slug: base }, select: { id: true } });
  if (!taken || taken.id === profileId) return base;
  return `${base}-${profileId}`;
}
