/** @import { AddEventObject } from '#public'*/

import { describe, it, expect } from 'vitest';
import {
	is_non_delegated,
	is_event_attribute,
	get_attribute_event_name,
	is_passive_event,
	is_capture_event,
} from '../../src/utils/events.js';

describe('events utility', () => {
	describe('is event delegated', () => {
		it('should confirm delegated events', () => {
			expect(is_non_delegated('click')).toBe(false);
			expect(is_non_delegated('input')).toBe(false);
			expect(is_non_delegated('change')).toBe(false);
			expect(is_non_delegated('mousedown')).toBe(false);
			expect(is_non_delegated('keydown')).toBe(false);
			expect(is_non_delegated('pointerdown')).toBe(false);
			expect(is_non_delegated('touchstart')).toBe(false);
			expect(is_non_delegated('focusin')).toBe(false);
			expect(is_non_delegated('focusout')).toBe(false);
		});

		it('should confirm non-delegated events', () => {
			expect(is_non_delegated('focus')).toBe(true);
			expect(is_non_delegated('blur')).toBe(true);
			expect(is_non_delegated('scroll')).toBe(true);
			expect(is_non_delegated('load')).toBe(true);
			expect(is_non_delegated('resize')).toBe(true);
		});

		it('should confirm that events with any capital letters are delegated', () => {
			expect(is_non_delegated('Click')).toBe(false);
			expect(is_non_delegated('CLICK')).toBe(false);
		});
	});

	describe('is_event_attribute', () => {
		it('should return true for valid event attributes', () => {
			expect(is_event_attribute('onClick')).toBe(true);
			expect(is_event_attribute('onInput')).toBe(true);
			expect(is_event_attribute('onChange')).toBe(true);
			expect(is_event_attribute('onMouseDown')).toBe(true);
			expect(is_event_attribute('onKeyPress')).toBe(true);
			expect(is_event_attribute('on-click')).toBe(true);
			expect(is_event_attribute('on_click')).toBe(true);
			expect(is_event_attribute('on$click')).toBe(true);
			expect(is_event_attribute('on$')).toBe(true);
			expect(is_event_attribute('on-')).toBe(true);
			expect(is_event_attribute('on_')).toBe(true);
			expect(is_event_attribute('on1')).toBe(true);
			expect(is_event_attribute('on1click')).toBe(true);
		});

		it('should return false for non-event attributes', () => {
			expect(is_event_attribute('on')).toBe(false);
			expect(is_event_attribute('onclick')).toBe(false);
			expect(is_event_attribute('class')).toBe(false);
			expect(is_event_attribute('id')).toBe(false);
			expect(is_event_attribute('value')).toBe(false);
			expect(is_event_attribute('aria-label')).toBe(false);
		});

		it('should require uppercase third character', () => {
			expect(is_event_attribute('onabc')).toBe(false);
			expect(is_event_attribute('onAbc')).toBe(true);
		});

		it('should require at least 3 characters', () => {
			expect(is_event_attribute('onA')).toBe(true);
			expect(is_event_attribute('on')).toBe(false);
			expect(is_event_attribute('o')).toBe(false);
			expect(is_event_attribute('')).toBe(false);
		});
	});

	describe('get_attribute_event_name', () => {
		it('should convert event attribute names to lowercase and strip "on" prefix', () => {
			const fn = () => {};
			expect(get_attribute_event_name('onClick', fn)).toBe('click');
			expect(get_attribute_event_name('onInput', fn)).toBe('input');
			expect(get_attribute_event_name('onMouseDown', fn)).toBe('mousedown');
			expect(get_attribute_event_name('onKeyPress', fn)).toBe('keypress');
			expect(get_attribute_event_name('onChange', fn)).toBe('change');
			expect(get_attribute_event_name('onFocus', fn)).toBe('focus');
		});

		it('should keep event attribute names letter case and strip "on" prefix', () => {
			/** @type AddEventObject */
			const customHandler = { handleEvent: () => {} };
			expect(get_attribute_event_name('onClick', { ...customHandler, customName: 'Click' })).toBe(
				'Click',
			);
			expect(get_attribute_event_name('onInput', { ...customHandler, customName: 'Input' })).toBe(
				'Input',
			);
			expect(
				get_attribute_event_name('onMouseDown', { ...customHandler, customName: 'MouseDown' }),
			).toBe('MouseDown');
		});
	});

	describe('is_capture_event', () => {
		it('should return true for capture events', () => {
			expect(is_capture_event('clickCapture')).toBe(true);
			expect(is_capture_event('mousedownCapture')).toBe(true);
			expect(is_capture_event('keydownCapture')).toBe(true);
		});

		it('should return false for non-capture events', () => {
			expect(is_capture_event('click')).toBe(false);
			expect(is_capture_event('mousedown')).toBe(false);
			expect(is_capture_event('mousedown')).toBe(false);
		});

		it('should exclude gotpointercapture and lostpointercapture', () => {
			expect(is_capture_event('gotpointercapture')).toBe(false);
			expect(is_capture_event('lostpointercapture')).toBe(false);
			expect(is_capture_event('gotPointerCapture')).toBe(false);
			expect(is_capture_event('lostPointerCapture')).toBe(false);
		});

		it('should be case-insensitive for pointer capture events', () => {
			expect(is_capture_event('GOTPOINTERCAPTURE')).toBe(false);
			expect(is_capture_event('LOSTPOINTERCAPTURE')).toBe(false);
		});

		it('should be case-sensitive for other events', () => {
			expect(is_capture_event('clickCapture')).toBe(true);
			expect(is_capture_event('keypressCapture')).toBe(true);
			expect(is_capture_event('clickcapture')).toBe(false);
			expect(is_capture_event('keypresscapture')).toBe(false);
		});
	});

	describe('is_passive_event', () => {
		it('should return true for passive events', () => {
			expect(is_passive_event('touchstart')).toBe(true);
			expect(is_passive_event('touchmove')).toBe(true);
			expect(is_passive_event('wheel')).toBe(true);
			expect(is_passive_event('mousewheel')).toBe(true);
		});

		it('should return false for non-passive events', () => {
			expect(is_passive_event('click')).toBe(false);
			expect(is_passive_event('mousedown')).toBe(false);
			expect(is_passive_event('touchend')).toBe(false);
			expect(is_passive_event('scroll')).toBe(false);
		});

		it('should be case-sensitive', () => {
			expect(is_passive_event('TouchStart')).toBe(false);
			expect(is_passive_event('TOUCHMOVE')).toBe(false);
		});
	});
});
