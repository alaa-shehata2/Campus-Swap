'use client';

import { useActionState, useState } from 'react';
import { publishAction, type PublishState } from '../app/actions';
import { Disclaimer } from './Disclaimer';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';
import { CATEGORIES } from '../../src/policy/taxonomy.js';

const initial: PublishState = { errors: [] };
const input = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';

export function PublishForm() {
  const [state, action] = useActionState(publishAction, initial);
  const [kind, setKind] = useState('skill');
  const [modality, setModality] = useState('lend');
  return (
    <>
      <Disclaimer flow="listing-create" />
      <form action={action} className="mt-4 max-w-xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Side
            <select name="side" className={input} defaultValue="offer">
              <option value="offer">Offer (I give)</option>
              <option value="request">Request (I need)</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Kind
            <select name="kind" className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="skill">Skill</option>
              <option value="item">Item</option>
            </select>
          </label>
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Title (max 80)
          </label>
          <input id="title" name="title" required maxLength={80} className={input} />
          <FieldErrors errors={state.errors} field="title" />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium">
            Description (max 2000)
          </label>
          <textarea id="description" name="description" required maxLength={2000} rows={5} className={input} />
          <FieldErrors errors={state.errors} field="description" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Category
            <select name="category" className={input} defaultValue="tutoring">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <FieldErrors errors={state.errors} field="category" />
          </label>
          <label className="text-sm font-medium">
            Campus zone / meetup area
            <input name="zone" required placeholder="e.g. North campus" className={input} />
            <FieldErrors errors={state.errors} field="zone" />
          </label>
        </div>
        <div>
          <label htmlFor="availability" className="block text-sm font-medium">
            Availability <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            id="availability"
            name="availability"
            maxLength={200}
            placeholder="e.g. weekday evenings"
            className={input}
          />
          <FieldErrors errors={state.errors} field="availability" />
        </div>
        {kind === 'item' && (
          <fieldset className="space-y-3 rounded border border-stone-200 p-4">
            <legend className="px-1 text-sm font-medium">Item terms</legend>
            <label className="block text-sm font-medium">
              Modality
              <select
                name="modality"
                className={input}
                value={modality}
                onChange={(e) => setModality(e.target.value)}
              >
                <option value="lend">Lend (return expected)</option>
                <option value="give">Give (permanent)</option>
                <option value="swap">Swap (item for item)</option>
              </select>
              <FieldErrors errors={state.errors} field="modality" />
            </label>
            {modality === 'lend' && (
              <div>
                <Disclaimer flow="item-lend" />
                <label htmlFor="returnTerm" className="mt-2 block text-sm font-medium">
                  Return date / duration (required for lend)
                </label>
                <input
                  id="returnTerm"
                  name="returnTerm"
                  required
                  placeholder="e.g. Return within 7 days"
                  className={input}
                />
                <FieldErrors errors={state.errors} field="returnTerm" />
              </div>
            )}
            {modality === 'swap' && (
              <div>
                <label htmlFor="counterpartDescription" className="block text-sm font-medium">
                  Desired counterpart (required for swap)
                </label>
                <input
                  id="counterpartDescription"
                  name="counterpartDescription"
                  required
                  placeholder="e.g. Calculus textbook, 4th edition"
                  className={input}
                />
                <FieldErrors errors={state.errors} field="counterpartDescription" />
              </div>
            )}
          </fieldset>
        )}
        <FieldErrors errors={state.errors} />
        <SubmitButton>Publish listing</SubmitButton>
      </form>
    </>
  );
}
