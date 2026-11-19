(() => {
 'use strict';

 const termSelector = '[data-basic-term]';
 const gap = 6;
 const edge = 10;
 const targetOf = event => event.target instanceof Element ? event.target : null;
 const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
 let current;
 let leaveTimer;
 let pointerType;

 const observer = new MutationObserver(() => {
  if (current && (!current.term.isConnected || (current.dialog && !current.dialog.open))) hide();
 });

 function hide() {
  clearTimeout(leaveTimer);
  if (!current) return;
  const {term, tip, previousDescription} = current;
  current = null;
  observer.disconnect();
  if (previousDescription === null) term.removeAttribute('aria-describedby');
  else term.setAttribute('aria-describedby', previousDescription);
  tip.remove();
 }

 function position() {
  if (!current) return;
  const {term, tip, dialog, supportsPopover} = current;
  const anchor = term.getBoundingClientRect();
  const viewport = window.visualViewport;
  let left = (viewport?.offsetLeft ?? 0) + edge;
  let top = (viewport?.offsetTop ?? 0) + edge;
  let right = left + (viewport?.width ?? document.documentElement.clientWidth) - 2 * edge;
  let bottom = top + (viewport?.height ?? document.documentElement.clientHeight) - 2 * edge;
  if (dialog && !supportsPopover) {
   const bounds = dialog.getBoundingClientRect();
   left = Math.max(left, bounds.left + edge);
   right = Math.min(right, bounds.right - edge);
   top = Math.max(top, bounds.top + edge);
   bottom = Math.min(bottom, bounds.bottom - edge);
  }
  if (anchor.bottom <= top - edge || anchor.top >= bottom + edge || right <= left || bottom <= top) {
   hide();
   return;
  }

  tip.style.width = Math.min(312, right - left) + 'px';
  tip.style.maxHeight = (bottom - top) + 'px';
  const {width, height} = tip.getBoundingClientRect();
  const above = anchor.top - top - gap;
  const below = bottom - anchor.bottom - gap;
  const putBelow = height <= below || (height > above && below >= above);
  tip.style.left = clamp((anchor.left + anchor.right - width) / 2, left, right - width) + 'px';
  tip.style.top = clamp(putBelow ? anchor.bottom + gap : anchor.top - height - gap, top, bottom - height) + 'px';
 }

 function definitionOf(term) {
  const glossary = window.QuizBasicTerms;
  const key = term.dataset.basicTerm;
  return glossary && Object.prototype.hasOwnProperty.call(glossary, key) ? glossary[key] : '';
 }

 function show(term, mode) {
  const definition = definitionOf(term);
  if (typeof definition !== 'string' || !definition.trim()) return;
  clearTimeout(leaveTimer);
  if (current?.term === term) {
   if (mode === 'pinned') current.mode = mode;
   return;
  }
  hide();
  const dialog = term.closest('dialog[open]');
  const tip = document.createElement('div');
  tip.id = 'v2-basic-definition';
  tip.className = 'v2-basic-definition';
  tip.setAttribute('role', 'tooltip');
  tip.textContent = definition;
  const supportsPopover = typeof tip.showPopover === 'function';
  if (supportsPopover) tip.setAttribute('popover', 'manual');

  (dialog || document.body).append(tip);
  if (supportsPopover) tip.showPopover();

  const previousDescription = term.getAttribute('aria-describedby');
  term.setAttribute('aria-describedby', [previousDescription, tip.id].filter(Boolean).join(' '));
  current = {term, tip, dialog, supportsPopover, mode, previousDescription};
  position();
  if (current) {
   observer.observe(document.body, {childList: true, subtree: true});
   if (dialog) observer.observe(dialog, {attributes: true, attributeFilter: ['open'], childList: true});
  }
 }

 function isOverBubble(target) {
  return current?.tip.contains(target) || current?.term.contains(target);
 }

 document.addEventListener('pointerover', event => {
  if (event.pointerType !== 'mouse') return;
  if (isOverBubble(targetOf(event))) clearTimeout(leaveTimer);
  const term = targetOf(event)?.closest(termSelector);
  if (term && !term.contains(event.relatedTarget) && current?.mode !== 'pinned') show(term, 'hover');
 });

 document.addEventListener('pointerout', event => {
  if (event.pointerType !== 'mouse' || current?.mode !== 'hover') return;
  if (isOverBubble(targetOf(event)) && !isOverBubble(event.relatedTarget)) {
   leaveTimer = setTimeout(hide, 140);
  }
 });

 document.addEventListener('pointerdown', event => {
  pointerType = event.pointerType;
 }, true);

 document.addEventListener('focusin', event => {
  const term = targetOf(event)?.closest(termSelector);
  if (term?.matches(':focus-visible')) show(term, 'focus');
 });

 document.addEventListener('focusout', event => {
  if (current?.mode !== 'pinned' && current?.term === event.target &&
      !current.term.contains(event.relatedTarget)) hide();
 });

 document.addEventListener('click', event => {
  const target = targetOf(event);
  const term = target?.closest(termSelector);
  const input = event.pointerType || pointerType;
  if (term) {
   event.preventDefault();
   event.stopPropagation();
   if (event.detail > 0 && input === 'mouse') show(term, 'hover');
   else if (current?.term === term && current.mode === 'pinned') hide();
   else show(term, 'pinned');
  } else if (current && !current.tip.contains(target)) {
   if (current.mode === 'pinned' && event.detail > 0 && input !== 'mouse' &&
       target?.closest('[data-option], [data-answer], [data-toggle-option]')) {
    event.preventDefault();
    event.stopPropagation();
   }
   hide();
  }
 }, true);

 document.addEventListener('keydown', event => {
  pointerType = '';
  if (!current) return;
  if (event.key === 'Tab') hide();
  if (event.key === 'Escape') {
   event.preventDefault();
   event.stopPropagation();
   hide();
  }
 }, true);

 document.addEventListener('cancel', event => {
  if (current?.dialog && current.dialog === event.target) {
   event.preventDefault();
   hide();
  }
 }, true);

 window.addEventListener('hashchange', hide);
 window.addEventListener('pagehide', hide);
 window.addEventListener('resize', position);
 window.addEventListener('scroll', event => {
  if (current && !current.tip.contains(targetOf(event))) hide();
 }, {capture: true, passive: true});
 window.visualViewport?.addEventListener('resize', position);
 window.visualViewport?.addEventListener('scroll', position, {passive: true});
})();
