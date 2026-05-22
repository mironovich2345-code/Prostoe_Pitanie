/**
 * Account deletion service — removes all data associated with a Telegram chatId.
 *
 * Security rules:
 *  - userId is resolved exclusively from UserIdentity (never accepted as input).
 *  - undefined is never passed to Prisma WHERE/OR.
 *  - Empty OR arrays never trigger deleteMany.
 *  - Only the caller's own records are touched.
 *
 * R2 storage files are NOT deleted here.
 * Storage keys that would be orphaned are listed in the returned `notes` array
 * so a follow-up task can remove them via deleteObject().
 *
 * Transaction: all DB writes run inside a single interactive Prisma transaction
 * with a 30-second timeout. If the transaction fails the entire operation is
 * rolled back and the error propagates to the caller.
 *
 * Models that are not yet in the generated Prisma client (Prisma generate has not
 * been re-run) are accessed via (prisma as any) — consistent with the rest of
 * the codebase. These are marked with inline comments.
 */

import prisma from '../db';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccountDeletionResult {
  ok: true;
  userId: string | null;
  chatIds: string[];
  deleted: Record<string, number>;
  notes: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a non-empty OR array for Prisma deleteMany / updateMany.
 * Null / undefined entries are dropped.
 * If the result is empty, the caller must skip the operation.
 */
function buildOr(...conds: (object | null | undefined)[]): object[] {
  return conds.filter((c): c is object => c != null);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function deleteAccountByTelegramChatId(
  telegramChatId: string | number,
): Promise<AccountDeletionResult> {
  const cidStr = String(telegramChatId);
  const deleted: Record<string, number> = {};
  const notes: string[] = [];

  // ── Phase 1: Resolve identity (reads, outside transaction) ───────────────────

  const identity = await prisma.userIdentity.findUnique({
    where: { platform_platformId: { platform: 'telegram', platformId: cidStr } },
    select: { userId: true },
  });

  const userId: string | null = identity?.userId ?? null;

  // All platform identities for this userId (telegram + max + phone)
  const allIdentities: { platform: string; platformId: string }[] = userId
    ? await prisma.userIdentity.findMany({
        where: { userId },
        select: { platform: true, platformId: true },
      })
    : [{ platform: 'telegram', platformId: cidStr }];

  // Build deduped legacy chatId set:
  //   - original telegram platformId
  //   - all linked telegram platformIds
  //   - all linked MAX platformIds
  //   - web_<userId> (some legacy Subscription rows use this format)
  const chatIdSet = new Set<string>([cidStr]);
  for (const id of allIdentities) {
    if (id.platform === 'telegram' || id.platform === 'max') {
      chatIdSet.add(id.platformId);
    }
  }
  if (userId) chatIdSet.add(`web_${userId}`);
  const chatIds = [...chatIdSet];

  // Phone numbers — used to clean up PhoneLoginCode rows
  const phoneNumbers = allIdentities
    .filter(id => id.platform === 'phone')
    .map(id => id.platformId);

  // ── Phase 2: Collect R2 notes (reads, outside transaction) ───────────────────

  const profileOrConds = buildOr(
    userId ? { userId } : null,
    chatIds.length > 0 ? { chatId: { in: chatIds } } : null,
  );

  if (profileOrConds.length > 0) {
    const mealKeys = await prisma.mealEntry.findMany({
      where: { OR: profileOrConds as never, photoStorageKey: { not: null } },
      select: { photoStorageKey: true },
    });
    if (mealKeys.length > 0) {
      notes.push(
        `R2: ${mealKeys.length} MealEntry.photoStorageKey will be orphaned — delete via deleteObject() in a separate task`,
      );
    }

    const tpKeys = await prisma.trainerProfile.findMany({
      where: { OR: profileOrConds as never, verificationPhotoStorageKey: { not: null } },
      select: { verificationPhotoStorageKey: true },
    });
    if (tpKeys.length > 0) {
      notes.push(
        `R2: ${tpKeys.length} TrainerProfile.verificationPhotoStorageKey will be orphaned — delete via deleteObject() in a separate task`,
      );
    }
  }

  if (chatIds.length > 0) {
    const docKeys = await prisma.trainerDocument.findMany({
      where: { chatId: { in: chatIds }, storageKey: { not: null } },
      select: { storageKey: true },
    });
    if (docKeys.length > 0) {
      notes.push(
        `R2: ${docKeys.length} TrainerDocument.storageKey will be orphaned — delete via deleteObject() in a separate task`,
      );
    }
  }

  if (userId) {
    // productSubmission needs cast — not yet in generated Prisma client
    const submKeys = await (prisma.productSubmission as any).findMany({
      where: { userId, photoStorageKey: { not: null } },
      select: { photoStorageKey: true },
    }) as { photoStorageKey: string | null }[];
    if (submKeys.length > 0) {
      notes.push(
        `R2: ${submKeys.length} ProductSubmission.photoStorageKey will be orphaned — delete via deleteObject() in a separate task`,
      );
    }
  }

  // ── Phase 3: Atomic deletion transaction ──────────────────────────────────────

  await prisma.$transaction(
    async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txAny = tx as any;

      // ── 0. Collect Payment IDs (needed to delete child PaymentAttempt rows) ───
      let paymentIds: string[] = [];
      if (userId) {
        const payments = await tx.payment.findMany({
          where: { userId },
          select: { id: true },
        }) as { id: string }[];
        paymentIds = payments.map(p => p.id);
      }

      // ── 1. PaymentAttempt (child of Payment; FK must go first) ───────────────
      if (paymentIds.length > 0) {
        // paymentAttempt not yet in generated client → cast
        const r = await txAny.paymentAttempt.deleteMany({
          where: { paymentId: { in: paymentIds } },
        }) as { count: number };
        deleted.paymentAttempt = r.count;
      }

      // ── 2. Analytics (no FK constraints on User) ─────────────────────────────
      if (userId) {
        // userEvent not yet in generated client → cast
        deleted.userEvent = ((await txAny.userEvent.deleteMany({
          where: { userId },
        })) as { count: number }).count;
      }

      const aiOrConds = buildOr(
        userId ? { userId } : null,
        chatIds.length > 0 ? { chatId: { in: chatIds } } : null,
      );
      if (aiOrConds.length > 0) {
        // aiCostLog not yet in generated client → cast
        deleted.aiCostLog = ((await txAny.aiCostLog.deleteMany({
          where: { OR: aiOrConds },
        })) as { count: number }).count;
      }

      if (userId) {
        deleted.productLookupLog = (await tx.productLookupLog.deleteMany({
          where: { userId },
        })).count;

        // productSubmission not yet in generated client → cast
        deleted.productSubmission = ((await txAny.productSubmission.deleteMany({
          where: { userId },
        })) as { count: number }).count;
      }

      // ── 3. Cache & reminders ──────────────────────────────────────────────────
      if (chatIds.length > 0) {
        deleted.mealReminder = (await tx.mealReminder.deleteMany({
          where: { chatId: { in: chatIds } },
        })).count;

        deleted.nutritionInsightCache = (await tx.nutritionInsightCache.deleteMany({
          where: { chatId: { in: chatIds } },
        })).count;
      }

      // ── 4. Trainer sub-records ────────────────────────────────────────────────

      // TrainerReward — trainer and referred-user sides
      const rewardOrConds = buildOr(
        userId ? { trainerUserId: userId } : null,
        userId ? { referredUserId: userId } : null,
        chatIds.length > 0 ? { trainerId: { in: chatIds } } : null,
        chatIds.length > 0 ? { referredChatId: { in: chatIds } } : null,
      );
      if (rewardOrConds.length > 0) {
        deleted.trainerReward = (await tx.trainerReward.deleteMany({
          where: { OR: rewardOrConds as never },
        })).count;
      }

      // TrainerDocument — only keyed by chatId
      if (chatIds.length > 0) {
        deleted.trainerDocument = (await tx.trainerDocument.deleteMany({
          where: { chatId: { in: chatIds } },
        })).count;
      }

      // TrainerRating — trainer and client sides
      const ratingOrConds = buildOr(
        userId ? { trainerUserId: userId } : null,
        userId ? { clientUserId: userId } : null,
        chatIds.length > 0 ? { trainerId: { in: chatIds } } : null,
        chatIds.length > 0 ? { clientId: { in: chatIds } } : null,
      );
      if (ratingOrConds.length > 0) {
        deleted.trainerRating = (await tx.trainerRating.deleteMany({
          where: { OR: ratingOrConds as never },
        })).count;
      }

      // TrainerReview — no userId fields; keyed only by chatId
      if (chatIds.length > 0) {
        deleted.trainerReview = (await tx.trainerReview.deleteMany({
          where: { OR: [{ clientId: { in: chatIds } }, { trainerId: { in: chatIds } }] as never },
        })).count;
      }

      // TrainerClientLink — trainer and client sides
      const linkOrConds = buildOr(
        userId ? { trainerUserId: userId } : null,
        userId ? { clientUserId: userId } : null,
        chatIds.length > 0 ? { trainerId: { in: chatIds } } : null,
        chatIds.length > 0 ? { clientId: { in: chatIds } } : null,
      );
      if (linkOrConds.length > 0) {
        deleted.trainerClientLink = (await tx.trainerClientLink.deleteMany({
          where: { OR: linkOrConds as never },
        })).count;
      }

      // ── 5. ExpertAcquisition — invited expert and referrer sides ─────────────
      const eaOrConds = buildOr(
        userId ? { invitedExpertUserId: userId } : null,
        userId ? { referrerUserId: userId } : null,
        chatIds.length > 0 ? { invitedExpertChatId: { in: chatIds } } : null,
        chatIds.length > 0 ? { referrerChatId: { in: chatIds } } : null,
      );
      if (eaOrConds.length > 0) {
        // expertAcquisition not yet in generated client → cast
        deleted.expertAcquisition = ((await txAny.expertAcquisition.deleteMany({
          where: { OR: eaOrConds },
        })) as { count: number }).count;
      }

      // ── 6. Requests & applications (ExpertApplication has FK to User) ────────
      if (userId) {
        deleted.clientExpertRequest = (await tx.clientExpertRequest.deleteMany({
          where: { OR: [{ clientUserId: userId }, { expertUserId: userId }] as never },
        })).count;

        // ExpertApplication has a required FK to User — must delete before User
        deleted.expertApplication = (await tx.expertApplication.deleteMany({
          where: { userId },
        })).count;

        // accountLinkRequest not yet in generated client → cast
        deleted.accountLinkRequest = ((await txAny.accountLinkRequest.deleteMany({
          where: { OR: [{ initiatorUserId: userId }, { canonicalUserId: userId }] },
        })) as { count: number }).count;

        deleted.webLoginToken = (await tx.webLoginToken.deleteMany({
          where: { userId },
        })).count;
      }

      // ── 7. Referral tails on OTHER users' profiles (nullify, not delete) ─────
      if (userId) {
        await tx.userProfile.updateMany({
          where: { referredByUserId: userId },
          data: { referredByUserId: null },
        });
      }
      if (chatIds.length > 0) {
        await tx.userProfile.updateMany({
          where: { referredBy: { in: chatIds } },
          data: { referredBy: null },
        });
      }

      // ── 8. Payments & subscriptions (FK constraints on User) ─────────────────
      if (userId) {
        // Payment has required FK to User — must delete before User
        deleted.payment = (await tx.payment.deleteMany({ where: { userId } })).count;

        // UserSubscription has required FK to User — must delete before User
        deleted.userSubscription = (await tx.userSubscription.deleteMany({
          where: { userId },
        })).count;
      }
      // Legacy chatId-keyed Subscription
      if (chatIds.length > 0) {
        deleted.subscription = (await tx.subscription.deleteMany({
          where: { chatId: { in: chatIds } },
        })).count;
      }

      // ── 9. Auth: phone OTP codes ──────────────────────────────────────────────
      if (phoneNumbers.length > 0) {
        deleted.phoneLoginCode = (await tx.phoneLoginCode.deleteMany({
          where: { phone: { in: phoneNumbers } },
        })).count;
      }

      // ── 10. Core user data ────────────────────────────────────────────────────
      const coreOrConds = buildOr(
        userId ? { userId } : null,
        chatIds.length > 0 ? { chatId: { in: chatIds } } : null,
      );
      if (coreOrConds.length > 0) {
        deleted.mealEntry = (await tx.mealEntry.deleteMany({
          where: { OR: coreOrConds as never },
        })).count;
        deleted.savedMeal = (await tx.savedMeal.deleteMany({
          where: { OR: coreOrConds as never },
        })).count;
        deleted.weightEntry = (await tx.weightEntry.deleteMany({
          where: { OR: coreOrConds as never },
        })).count;
        // UserProfile has optional FK to User — delete before User to avoid constraint
        deleted.userProfile = (await tx.userProfile.deleteMany({
          where: { OR: coreOrConds as never },
        })).count;
        // TrainerProfile has optional FK to User — delete before User to avoid constraint
        deleted.trainerProfile = (await tx.trainerProfile.deleteMany({
          where: { OR: coreOrConds as never },
        })).count;
      }

      if (userId) {
        // userLegalConsent not yet in generated client → cast
        deleted.userLegalConsent = ((await txAny.userLegalConsent.deleteMany({
          where: { userId },
        })) as { count: number }).count;
      }

      // PayoutRequest — by trainerUserId or trainerId (chatId)
      const prOrConds = buildOr(
        userId ? { trainerUserId: userId } : null,
        chatIds.length > 0 ? { trainerId: { in: chatIds } } : null,
      );
      if (prOrConds.length > 0) {
        deleted.payoutRequest = (await tx.payoutRequest.deleteMany({
          where: { OR: prOrConds as never },
        })).count;
      }

      // ── 11. UserIdentity & User (User must be last; all FKs removed above) ───
      if (userId) {
        deleted.userIdentity = (await tx.userIdentity.deleteMany({
          where: { userId },
        })).count;

        await tx.user.delete({ where: { id: userId } });
        deleted.user = 1;
      } else {
        notes.push(
          'No UserIdentity found for this chatId — User record not deleted (may be legacy-only or already deleted).',
        );
      }
    },
    { timeout: 30_000 },
  );

  return { ok: true, userId, chatIds, deleted, notes };
}
