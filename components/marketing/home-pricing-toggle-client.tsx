'use client';

import { useEffect } from 'react';

function applyPricingMode(mode: 'monthly' | 'annual') {
  const monthlyToggle = document.getElementById('tog-m');
  const annualToggle = document.getElementById('tog-a');
  const starterPrice = document.getElementById('ps');
  const proPrice = document.getElementById('pp');
  if (!monthlyToggle || !annualToggle || !starterPrice || !proPrice) return;

  const monthly = mode === 'monthly';
  monthlyToggle.classList.toggle('on', monthly);
  annualToggle.classList.toggle('on', !monthly);
  const saveBadge = document.getElementById('home-pt-save-badge');
  if (saveBadge) saveBadge.classList.toggle('is-visible', !monthly);
  starterPrice.innerHTML = monthly ? '$79<span>/ month</span>' : '$63<span>/ month</span>';
  proPrice.innerHTML = monthly ? '$149<span>/ month</span>' : '$119<span>/ month</span>';
}

export function HomePricingToggleClient() {
  useEffect(() => {
    const monthlyToggle = document.getElementById('tog-m');
    const annualToggle = document.getElementById('tog-a');
    if (!monthlyToggle || !annualToggle) return;

    const onMonthly = (event: Event) => {
      event.preventDefault();
      applyPricingMode('monthly');
    };
    const onAnnual = (event: Event) => {
      event.preventDefault();
      applyPricingMode('annual');
    };

    monthlyToggle.addEventListener('click', onMonthly);
    annualToggle.addEventListener('click', onAnnual);
    applyPricingMode('monthly');

    return () => {
      monthlyToggle.removeEventListener('click', onMonthly);
      annualToggle.removeEventListener('click', onAnnual);
    };
  }, []);

  return null;
}

