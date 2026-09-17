import { fail, ok, type FieldError, type Result } from '../common/errors.js';
import { isCategory } from '../policy/taxonomy.js';
import { isProhibited } from '../policy/prohibited.js';
import { ListingsStore } from './store.js';
import type {
  Listing,
  ListingTransition,
  PublishInput,
} from './types.js';

export const MAX_TITLE_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_ACTIVE_LISTINGS = 20;
export const MAX_SKILL_IMAGES = 2;
export const MAX_ITEM_IMAGES = 5;

export function createListingsService(store = new ListingsStore()) {
  function publish(ownerId: string, input: PublishInput): Result<Listing> {
    const errors: FieldError[] = [];

    if (!['offer', 'request'].includes(input.side)) {
      errors.push({ code: 'invalid', field: 'side', message: 'Side must be offer or request.' });
    }
    if (!['skill', 'item'].includes(input.kind)) {
      errors.push({ code: 'invalid', field: 'kind', message: 'Kind must be skill or item.' });
    }
    const title = input.title?.trim() ?? '';
    if (!title) {
      errors.push({ code: 'required', field: 'title', message: 'Title is required.' });
    } else if (title.length > MAX_TITLE_LENGTH) {
      errors.push({
        code: 'too-long',
        field: 'title',
        message: `Title must be at most ${MAX_TITLE_LENGTH} characters.`,
      });
    }
    const description = input.description?.trim() ?? '';
    if (!description) {
      errors.push({ code: 'required', field: 'description', message: 'Description is required.' });
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        code: 'too-long',
        field: 'description',
        message: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
      });
    }
    if (!isCategory(input.category ?? '')) {
      errors.push({
        code: 'invalid',
        field: 'category',
        message: 'Choose a category from the fixed taxonomy.',
      });
    }
    if (!input.zone?.trim()) {
      errors.push({ code: 'required', field: 'zone', message: 'Campus zone / meetup area is required.' });
    }
    const maxImages = input.kind === 'item' ? MAX_ITEM_IMAGES : MAX_SKILL_IMAGES;
    if (!Array.isArray(input.images) || input.images.length > maxImages) {
      errors.push({
        code: 'too-many',
        field: 'images',
        message:
          input.kind === 'item'
            ? `Items allow at most ${MAX_ITEM_IMAGES} images.`
            : `Skills allow at most ${MAX_SKILL_IMAGES} images.`,
      });
    }

    if (input.kind === 'item') {
      if (!['lend', 'give', 'swap'].includes(input.modality ?? '')) {
        errors.push({
          code: 'required',
          field: 'modality',
          message: 'Item modality is required: lend, give, or swap.',
        });
      } else if (input.modality === 'lend' && !input.returnTerm?.trim()) {
        errors.push({
          code: 'required',
          field: 'returnTerm',
          message: 'Lend requires a lender-defined return date/duration.',
        });
      } else if (input.modality === 'swap' && !input.counterpartDescription?.trim()) {
        errors.push({
          code: 'required',
          field: 'counterpartDescription',
          message: 'Swap requires a description of the desired counterpart.',
        });
      }
    }

    const status = input.status ?? 'Active';
    if (!['Draft', 'Active', 'Paused', 'Archived'].includes(status)) {
      errors.push({
        code: 'invalid',
        field: 'status',
        message: 'Status must be Draft, Active, Paused, or Archived.',
      });
    }

    if (errors.length > 0) return fail(errors);

    const screened = isProhibited(title, description);
    if (screened.blocked) {
      return fail([
        {
          code: 'prohibited',
          message: `This listing cannot be published (class: ${screened.reason}). See community rules.`,
        },
      ]);
    }

    if (status === 'Active' && store.countActiveByOwner(ownerId) >= MAX_ACTIVE_LISTINGS) {
      return fail([
        {
          code: 'listing-cap-reached',
          message: `You already have ${MAX_ACTIVE_LISTINGS} active listings. Pause or archive one to publish another.`,
        },
      ]);
    }

    const listing = store.insert({
      ownerId,
      side: input.side,
      kind: input.kind,
      title,
      description,
      category: input.category as Listing['category'],
      zone: input.zone.trim(),
      images: input.images,
      status,
      modality: input.kind === 'item' ? input.modality : undefined,
      returnTerm:
        input.kind === 'item' && input.modality === 'lend' ? input.returnTerm!.trim() : undefined,
      counterpartDescription:
        input.kind === 'item' && input.modality === 'swap'
          ? input.counterpartDescription!.trim()
          : undefined,
    });
    return ok(listing);
  }

  function update(ownerId: string, id: string, patch: Partial<PublishInput>): Result<Listing> {
    const current = store.get(id);
    if (!current) return fail([{ code: 'not-found', message: 'Listing not found.' }]);
    if (current.ownerId !== ownerId) {
      return fail([{ code: 'not-permitted', message: 'Only the owner can edit this listing.' }]);
    }
    // Validate onto a working copy; the store is only written when everything passes.
    const next: Listing = { ...current, images: [...current.images] };

    if (patch.title !== undefined) {
      const t = patch.title.trim();
      if (!t) return fail([{ code: 'required', field: 'title', message: 'Title cannot be empty.' }]);
      if (t.length > MAX_TITLE_LENGTH) {
        return fail([
          { code: 'too-long', field: 'title', message: `Title must be at most ${MAX_TITLE_LENGTH} characters.` },
        ]);
      }
      next.title = t;
    }
    if (patch.description !== undefined) {
      const d = patch.description.trim();
      if (!d) {
        return fail([{ code: 'required', field: 'description', message: 'Description cannot be empty.' }]);
      }
      if (d.length > MAX_DESCRIPTION_LENGTH) {
        return fail([
          {
            code: 'too-long',
            field: 'description',
            message: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
          },
        ]);
      }
      next.description = d;
    }
    if (patch.category !== undefined) {
      if (!isCategory(patch.category)) {
        return fail([
          { code: 'invalid', field: 'category', message: 'Choose a category from the fixed taxonomy.' },
        ]);
      }
      next.category = patch.category;
    }
    if (patch.zone !== undefined) {
      if (!patch.zone.trim()) {
        return fail([
          { code: 'required', field: 'zone', message: 'Campus zone / meetup area cannot be empty.' },
        ]);
      }
      next.zone = patch.zone.trim();
    }
    if (patch.images !== undefined) {
      const maxImages = next.kind === 'item' ? MAX_ITEM_IMAGES : MAX_SKILL_IMAGES;
      if (!Array.isArray(patch.images) || patch.images.length > maxImages) {
        return fail([
          {
            code: 'too-many',
            field: 'images',
            message:
              next.kind === 'item'
                ? `Items allow at most ${MAX_ITEM_IMAGES} images.`
                : `Skills allow at most ${MAX_SKILL_IMAGES} images.`,
          },
        ]);
      }
      next.images = [...patch.images];
    }
    if (patch.modality !== undefined || patch.returnTerm !== undefined || patch.counterpartDescription !== undefined) {
      if (next.kind !== 'item') {
        return fail([
          { code: 'invalid', field: 'modality', message: 'Only item listings have a modality.' },
        ]);
      }
      const modality = patch.modality ?? next.modality;
      if (!['lend', 'give', 'swap'].includes(modality ?? '')) {
        return fail([
          { code: 'required', field: 'modality', message: 'Item modality is required: lend, give, or swap.' },
        ]);
      }
      const returnTerm = patch.returnTerm ?? next.returnTerm;
      const counterpart = patch.counterpartDescription ?? next.counterpartDescription;
      if (modality === 'lend' && !returnTerm?.trim()) {
        return fail([
          { code: 'required', field: 'returnTerm', message: 'Lend requires a lender-defined return date/duration.' },
        ]);
      }
      if (modality === 'swap' && !counterpart?.trim()) {
        return fail([
          { code: 'required', field: 'counterpartDescription', message: 'Swap requires a description of the desired counterpart.' },
        ]);
      }
      next.modality = modality;
      next.returnTerm = modality === 'lend' ? returnTerm!.trim() : undefined;
      next.counterpartDescription = modality === 'swap' ? counterpart!.trim() : undefined;
    }

    const screened = isProhibited(next.title, next.description);
    if (screened.blocked) {
      return fail([
        { code: 'prohibited', message: `This listing cannot be kept (class: ${screened.reason}).` },
      ]);
    }
    store.save(next);
    return ok(next);
  }

  function transition(ownerId: string, id: string, to: ListingTransition): Result<Listing> {
    const listing = store.get(id);
    if (!listing) return fail([{ code: 'not-found', message: 'Listing not found.' }]);
    if (listing.ownerId !== ownerId) {
      return fail([{ code: 'not-permitted', message: 'Only the owner can change this listing.' }]);
    }
    if (to === 'activate') {
      if (listing.status !== 'Draft') {
        return fail([
          { code: 'invalid-transition', field: 'status', message: 'Only Draft listings can be activated.' },
        ]);
      }
      if (store.countActiveByOwner(ownerId) >= MAX_ACTIVE_LISTINGS) {
        return fail([
          {
            code: 'listing-cap-reached',
            message: `You already have ${MAX_ACTIVE_LISTINGS} active listings.`,
          },
        ]);
      }
      listing.status = 'Active';
    } else if (to === 'pause') {
      if (listing.status !== 'Active') {
        return fail([
          { code: 'invalid-transition', field: 'status', message: 'Only Active listings can be paused.' },
        ]);
      }
      listing.status = 'Paused';
    } else if (to === 'archive') {
      listing.status = 'Archived';
    } else {
      if (listing.status !== 'Paused') {
        return fail([
          { code: 'invalid-transition', field: 'status', message: 'Only Paused listings can be reopened.' },
        ]);
      }
      if (store.countActiveByOwner(ownerId) >= MAX_ACTIVE_LISTINGS) {
        return fail([
          {
            code: 'listing-cap-reached',
            message: `You already have ${MAX_ACTIVE_LISTINGS} active listings.`,
          },
        ]);
      }
      listing.status = 'Active';
    }
    store.save(listing);
    return ok(listing);
  }

  /**
   * System auto-pause on proposal accept (arch §4: owner transitions plus
   * system auto-pause). No owner check — the system performs it, auditably.
   * INTERNAL: never wire to a route without an owner check; HTTP layer must
   * call transition() for user-initiated pauses.
   */
  function systemPause(id: string): Result<Listing> {
    const listing = store.get(id);
    if (!listing) return fail([{ code: 'not-found', message: 'Listing not found.' }]);
    if (listing.status !== 'Active') {
      return fail([
        { code: 'invalid-transition', field: 'status', message: 'Only Active listings can be paused.' },
      ]);
    }
    listing.status = 'Paused';
    store.save(listing);
    return ok(listing);
  }

  function get(id: string): Listing | undefined {
    return store.get(id);
  }

  return { publish, update, transition, systemPause, get, store };
}

export type ListingsService = ReturnType<typeof createListingsService>;
