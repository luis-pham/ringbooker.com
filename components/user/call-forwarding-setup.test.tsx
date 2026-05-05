import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CallForwardingSetup, getGeneratedDialCode, getInitialSetupState } from './call-forwarding-setup';
import { findCarrier } from '@/lib/call-forwarding/carrier-data';

test('initial state opens forwarding setup (no alternate number path)', () => {
  const html = renderToStaticMarkup(<CallForwardingSetup ringbookerNumber="+13083020242" />);
  assert.equal(getInitialSetupState(), 'forward_setup');
  assert.match(html, /Forward from your current business line/);
  assert.match(html, /RingBooker forwarding number/);
  assert.doesNotMatch(html, /Use a new RingBooker number/);
  assert.doesNotMatch(html, /Share this number with clients/);
});

test('forward_setup shows carrier selection', () => {
  const html = renderToStaticMarkup(<CallForwardingSetup ringbookerNumber="+13083020242" initialMethod="forward" />);
  assert.match(html, /Select your carrier/);
});

test('dial code generated correctly', () => {
  assert.equal(getGeneratedDialCode(findCarrier('us', 'verizon'), 'no_answer', '+1234'), '*71+1234');
  assert.equal(getGeneratedDialCode(findCarrier('us', 'att'), 'all', '+1234'), '*21*+1234#');
});

test('app-based carrier hides dial code and shows app steps', () => {
  const html = renderToStaticMarkup(
    <CallForwardingSetup ringbookerNumber="+1234" initialMethod="forward" initialCountry="us" initialCarrier="googlevoice" />,
  );
  assert.doesNotMatch(html, /Dial this code on your phone/);
  assert.match(html, /Open voice.google.com or the Google Voice app/);
});

test('callForwardingPageUrl link opens in new tab', () => {
  const html = renderToStaticMarkup(
    <CallForwardingSetup ringbookerNumber="+1234" callForwardingPageUrl="/current-number/call-forwarding" initialMethod="forward" initialCountry="us" initialCarrier="verizon" />,
  );
  assert.match(html, /href="\/current-number\/call-forwarding"/);
  assert.match(html, /target="_blank"/);
});

test('unavailable type is disabled for Nextiva all forwarding', () => {
  const html = renderToStaticMarkup(
    <CallForwardingSetup ringbookerNumber="+1234" initialMethod="forward" initialCountry="us" initialCarrier="nextiva" initialForwardingType="no_answer" />,
  );
  assert.match(html, /Forward all calls/);
  assert.match(html, /cf-type-row[^"]*disabled/);
});

test('suppressForwardingTestCta hides optional test button', () => {
  const html = renderToStaticMarkup(
    <CallForwardingSetup ringbookerNumber="+13083020242" initialMethod="forward" suppressForwardingTestCta />,
  );
  assert.doesNotMatch(html, /Optional check — try connectivity test/);
});

test('initial state helper always returns forward_setup', () => {
  assert.equal(getInitialSetupState('forward'), 'forward_setup');
  assert.equal(getInitialSetupState('new_number'), 'forward_setup');
});
