import { describe, it, expect } from 'vitest';
import {
	is_delegated,
	is_event_attribute,
	is_capture_event,
	get_attribute_event_name,
	is_passive_event
} from '../../src/utils/events.js';

describe('events utility', () => {
	describe('is_delegated', () => {
		it('should return true for delegated events', () => {
			expect(is_delegated('click')).toBe(true);
			expect(is_delegated('input')).toBe(true);
			expect(is_delegated('change')).toBe(true);
			expect(is_delegated('mousedown')).toBe(true);
			expect(is_delegated('keydown')).toBe(true);
			expect(is_delegated('pointerdown')).toBe(true);
			expect(is_delegated('touchstart')).toBe(true);
			expect(is_delegated('focusin')).toBe(true);
			expect(is_delegated('focusout')).toBe(true);
		});

		it('should return false for non-delegated events', () => {
			expect(is_delegated('focus')).toBe(false);
			expect(is_delegated('blur')).toBe(false);
			expect(is_delegated('scroll')).toBe(false);
			expect(is_delegated('load')).toBe(false);
			expect(is_delegated('resize')).toBe(false);
		});

		it('should be case-sensitive', () => {
			expect(is_delegated('Click')).toBe(false);
			expect(is_delegated('CLICK')).toBe(false);
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
		})
	});

	describe('get_attribute_event_name', () => {
		it('should convert event attribute names to lowercase and strip "on" prefix', () => {
			expect(get_attribute_event_name('onClick')).toBe('click');
			expect(get_attribute_event_name('onInput')).toBe('input');
			expect(get_attribute_event_name('onMouseDown')).toBe('mousedown');
			expect(get_attribute_event_name('onKeyPress')).toBe('keypress');
			expect(get_attribute_event_name('onChange')).toBe('change');
			expect(get_attribute_event_name('onFocus')).toBe('focus');
		});

		it('should handle capture events and strip both "on" and "Capture"', () => {
			expect(get_attribute_event_name('onClickCapture')).toBe('click');
			expect(get_attribute_event_name('onMouseDownCapture')).toBe('mousedown');
			expect(get_attribute_event_name('onMouseDownCapture')).toBe('mousedown');
			expect(get_attribute_event_name('onGotPointerCapture')).toBe('gotpointercapture');
			expect(get_attribute_event_name('onLostPointerCapture')).toBe('lostpointercapture');
		});
	});

	describe('is_passive_event', () => {
		it('should return true for passive events', () => {
			expect(is_passive_event('touchstart')).toBe(true);
			expect(is_passive_event('touchmove')).toBe(true);
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
