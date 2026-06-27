import pathlib

p = pathlib.Path('/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/api/app.ts')
lines = p.read_text().split('\n')

# Find the /health route line (1-indexed line with "app.get(path('/health')")
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if start_idx is None and "app.get(path('/health')" in line:
        start_idx = i  # 0-indexed
    if start_idx is not None and "app.post(path('/webhooks/telnyx')" in line:
        end_idx = i  # 0-indexed, the line AFTER the /readiness block (next route)
        break

print(f'Found /health at line {start_idx+1}, next route at line {end_idx+1}')
print(f'First line: {lines[start_idx]!r}')
print(f'Line before next: {lines[end_idx-1]!r}')

# The /readiness block ends with "  });" — find the blank line before the webhooks route
# Lines start_idx..end_idx-1 are the health+readiness block (including trailing blank line)
# Replace with registerHealthRoutes call
replacement = [
    '  registerHealthRoutes(app, path, { runtimeInfo: deps.runtimeInfo });',
    '',
]

new_lines = lines[:start_idx] + replacement + lines[end_idx:]
p.write_text('\n'.join(new_lines))
print(f'Replaced lines {start_idx+1}-{end_idx} with registerHealthRoutes call')
print(f'New file: {len(new_lines)} lines')