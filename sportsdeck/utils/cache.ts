import { prisma } from "@/prisma/db";

export async function getCached<T>(
  key: string,
  ttlMinutes: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = await prisma.apiCache.findUnique({
    where: { key },
  });

  if (cached && new Date() < new Date(cached.expiresAt)) {
    return JSON.parse(cached.data) as T;
  }

  const freshData = await fetchFn();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  await prisma.apiCache.upsert({
    where: { key },
    update: {
      data: JSON.stringify(freshData),
      cachedAt: now,
      expiresAt,
    },
    create: {
      key,
      data: JSON.stringify(freshData),
      cachedAt: now,
      expiresAt,
    },
  });

  return freshData;
}

export async function invalidateCache(key: string): Promise<void> {
  await prisma.apiCache.deleteMany({ where: { key } });
}
