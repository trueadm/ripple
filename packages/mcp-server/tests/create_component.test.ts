import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ripple_create_component } from '../src/tools/create_component.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../temp-test');

describe('ripple_create_component tool', () => {
	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it('should create a component file', async () => {
		const result = await ripple_create_component.handler({
			name: 'TestComponent',
			content: 'component TestComponent() { <div>{"Test"}</div> }',
			path: testDir,
		});

		expect(result.isError).toBeFalsy();
		expect(result.content[0].text).toContain('TestComponent created');

		const filePath = path.join(testDir, 'TestComponent.ripple');
		const fileExists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false);
		expect(fileExists).toBe(true);

		const content = await fs.readFile(filePath, 'utf-8');
		expect(content).toBe('component TestComponent() { <div>{"Test"}</div> }');
	});

	it('should create component in current directory if no path provided', async () => {
		const result = await ripple_create_component.handler({
			name: 'SimpleComponent',
			content: 'component SimpleComponent() {}',
		});

		expect(result.isError).toBeFalsy();
		expect(result.content[0].text).toContain('SimpleComponent created');

		// Clean up
		const filePath = path.resolve(process.cwd(), 'SimpleComponent.ripple');
		await fs.unlink(filePath).catch(() => {});
	});

	it('should handle errors gracefully', async () => {
		const result = await ripple_create_component.handler({
			name: 'Test/Invalid',
			content: 'test',
			path: '/invalid/path/that/does/not/exist',
		});

		// Should still succeed because we create directories recursively
		expect(result.isError).toBeFalsy();

		// Clean up
		await fs.rm('/invalid', { recursive: true, force: true }).catch(() => {});
	});
});
