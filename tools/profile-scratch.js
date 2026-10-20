import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Each test process gets its own throwaway profile file, wiped on load. Tests
// therefore start every run with brand-new operatives (35 credits, full HP,
// level 1) instead of inheriting whatever an earlier run left behind.
export const TEST_PROFILE_FILE = path.join(os.tmpdir(), 'sleeves-test-profiles-' + process.pid + '.json');
fs.rmSync(TEST_PROFILE_FILE, { force: true });
