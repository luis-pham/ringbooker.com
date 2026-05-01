import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CallForwardingSetup, getGeneratedDialCode, getInitialSetupState } from './call-forwarding-setup';
import { findCarrier } from '@/lib/call-forwarding/carrier-data';

test('initial state is choose_method', () => {
  const html = renderToStaticMarkup(<CallForwardingSetup ringbookerNumber="+13083020242" />);
  assert.equal(getInitialSetupState(), 'choose_method');
  assert.match(html, /Forward my existing business number/);
  assert.match(html, /Use a new RingBooker number/);
  assert.match(html, /disabled=""/);
});

test('initialMethod forward renders forward_setup', () => {
  const html = renderToStaticMarkup(<CallForwardingSetup ringbookerNumber="+13083020242" initialMethod="forward" />);
  assert.match(html, /Forward your existing number/);
  assert.match(html, /Select your carrier/);
});

test('initialMethod new_number renders new_number_info with number', () => {
  const html = renderToStaticMarkup(<CallForwardingSetup ringbookerNumber="+13083020242" initialMethod="new_number" />);
  assert.match(html, /Your new RingBooker number/);
  assert.match(html, /\+13083020242/);
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

test('initial state helper supports completion method routing', () => {
  assert.equal(getInitialSetupState('forward'), 'forward_setup');
  assert.equal(getInitialSetupState('new_number'), 'new_number_info');
});
